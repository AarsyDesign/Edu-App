/**
 * Baseline Assessment API (VRD Phase 8.1, 8.3–8.5, 8.7).
 *
 * GET    /api/assessment/baseline?child=<uuid>
 *        → { activities: [...] }  daftar 5–10 aktivitas asesmen dasar.
 *        409 `ALREADY_COMPLETED` bila baseline sudah pernah diselesaikan.
 *
 * POST   /api/assessment/baseline
 *        body: { childId, attempts: [{ activityId, skillId, learningAreaId,
 *                childAnswer, isCorrect, durationMs? }] }  (5–10 attempt)
 *        → { sessionId, skillEstimates, recommendedStartingSkills }
 *
 * DELETE /api/assessment/baseline?child=<uuid>
 *        → { reset: true }  memulai ulang asesmen dasar (VRD 8.7).
 *        Baris sesi baseline dihapus; riwayat jawaban TIDAK ikut terhapus
 *        (FK activity_attempt → learning_session ber-ON DELETE SET NULL,
 *        kolom session_id memang nullable untuk asesmen dasar).
 *
 * Keamanan: seluruh endpoint berada di bawah prefix `/api/assessment` yang
 * dijaga middleware (VRD 3.5) + `parentIdOf()` (VRD 3.8) + `getChildForParent`
 * (VRD 3.7). Permintaan pembuat-perubahan memeriksa Origin (CSRF berlapis)
 * dan body dibatasi 8 KB. Tidak ada label lulus/gagal (VRD 8.6).
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { getChildForParent } from "../../../lib/auth/guard.ts";
import {
  selectBaselineActivities,
  calculateSkillEstimates,
  getRecommendedStartingSkills,
  storeBaselineResult,
} from "../../../lib/assessment/baseline.ts";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../../../lib/auth/http.ts";

/** Sesi baseline = sesi yang langsung selesai (started_at = ended_at). */
const BASELINE_SESSION_SQL = `SELECT COUNT(*) as count
     FROM learning_session
      WHERE child_id = $1::uuid
        AND started_at = ended_at`;

export const GET: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const childId = context.url.searchParams.get("child");
  if (!childId) {
    return errorResponse(400, "BAD_REQUEST", "Parameter child diperlukan");
  }

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  const baselineCheck = await db.query<{ count: string }>(BASELINE_SESSION_SQL, [childId]);
  if (Number(baselineCheck.rows[0].count) > 0) {
    return errorResponse(409, "ALREADY_COMPLETED", "Asesmen dasar sudah diselesaikan");
  }

  // Seed = childId supaya GET ulang mengembalikan kumpulan yang sama.
  const selected = await selectBaselineActivities(db, child.age, childId, 8);

  const activityDetails = [];
  for (const act of selected) {
    const rows = await db.query<{
      id: string;
      skill_id: string;
      learning_area_id: string;
      prompt: string;
      interaction_type: string;
      correct_answer: unknown;
      explanation: string | null;
      target_age_min: number;
      target_age_max: number;
      difficulty: number;
    }>(
      `SELECT id, skill_id, learning_area_id, prompt, interaction_type,
              correct_answer, explanation, target_age_min, target_age_max, difficulty
       FROM activity
       WHERE id = $1::uuid
         AND review_status = 'PUBLISHED'`,
      [act.activityId],
    );
    if (rows.rows.length > 0) {
      const r = rows.rows[0];
      activityDetails.push({
        activityId: r.id,
        skillId: r.skill_id,
        learningAreaId: r.learning_area_id,
        prompt: r.prompt,
        interactionType: r.interaction_type,
        correctAnswer: r.correct_answer,
        explanation: r.explanation,
        targetAgeMin: r.target_age_min,
        targetAgeMax: r.target_age_max,
        difficulty: r.difficulty,
      });
    }
  }

  return jsonResponse({ activities: activityDetails });
};

interface BaselineAttemptBody {
  activityId: string;
  skillId: string;
  learningAreaId: string;
  childAnswer: unknown;
  isCorrect: boolean;
  durationMs?: number;
}

export const POST: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;
  if (!isSameOrigin(context.request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak");
  }

  const parsed = await readJsonBody(context.request);
  if (parsed === null) {
    return errorResponse(400, "BAD_REQUEST", "Body harus JSON valid dan di bawah 8 KB");
  }

  const childId = typeof parsed.childId === "string" ? parsed.childId : "";
  const attempts = Array.isArray(parsed.attempts)
    ? (parsed.attempts as BaselineAttemptBody[])
    : null;
  if (!childId || attempts === null) {
    return errorResponse(400, "BAD_REQUEST", "childId dan attempts wajib diisi");
  }

  // 8.8: asesmen tetap pendek — 5–10 aktivitas.
  if (attempts.length < 5 || attempts.length > 10) {
    return errorResponse(400, "BAD_REQUEST", "Asesmen dasar harus 5–10 aktivitas");
  }

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  const baselineCheck = await db.query<{ count: string }>(BASELINE_SESSION_SQL, [childId]);
  if (Number(baselineCheck.rows[0].count) > 0) {
    return errorResponse(409, "ALREADY_COMPLETED", "Asesmen dasar sudah diselesaikan");
  }

  // Semua aktivitas wajib PUBLISHED (konten melewati review, PRD §7).
  for (const attempt of attempts) {
    if (!attempt || typeof attempt !== "object") {
      return errorResponse(400, "BAD_REQUEST", "Setiap attempt harus berbentuk objek");
    }
    if (!attempt.activityId || !attempt.skillId || !attempt.learningAreaId) {
      return errorResponse(400, "BAD_REQUEST", "Setiap attempt harus punya activityId, skillId, learningAreaId");
    }
    if (typeof attempt.isCorrect !== "boolean") {
      return errorResponse(400, "BAD_REQUEST", "isCorrect harus boolean");
    }
    const check = await db.query<{ id: string }>(
      `SELECT id FROM activity WHERE id = $1::uuid AND review_status = 'PUBLISHED'`,
      [attempt.activityId],
    );
    if (check.rows.length === 0) {
      return errorResponse(400, "BAD_REQUEST", "Aktivitas tidak valid atau belum dipublikasikan");
    }
  }

  const completedAt = new Date();
  const normalizedAttempts = attempts.map((a) => ({
    activityId: a.activityId,
    skillId: a.skillId,
    learningAreaId: a.learningAreaId,
    childAnswer: a.childAnswer,
    isCorrect: a.isCorrect,
    durationMs: typeof a.durationMs === "number" ? a.durationMs : undefined,
  }));

  const skillEstimates = calculateSkillEstimates(normalizedAttempts);
  const recommendedStartingSkills = await getRecommendedStartingSkills(
    db,
    childId,
    child.age,
    skillEstimates,
  );

  const sessionId = await storeBaselineResult(db, childId, {
    childId,
    attempts: normalizedAttempts,
    skillEstimates,
    recommendedStartingSkills,
    completedAt,
  });

  return jsonResponse({ sessionId, skillEstimates, recommendedStartingSkills }, 201);
};

/** VRD 8.7 — orang tua boleh memulai ulang asesmen dasar. */
export const DELETE: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;
  if (!isSameOrigin(context.request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak");
  }

  const childId = context.url.searchParams.get("child");
  if (!childId) {
    return errorResponse(400, "BAD_REQUEST", "Parameter child diperlukan");
  }

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  // Hapus hanya sesi baseline; attempt tetap ada (session_id jadi NULL).
  await db.query(
    `DELETE FROM learning_session
      WHERE child_id = $1::uuid
        AND started_at = ended_at`,
    [childId],
  );

  return jsonResponse({ reset: true });
};
