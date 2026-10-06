/**
 * POST /api/activity/attempt — jawaban anak untuk satu aktivitas
 * (PRD §10: jawab → umpan balik langsung → progres tersimpan).
 *
 * Body: { childId, activityId, sessionId, answer, durationMs? }
 * → 201 { attemptId, attemptNo, correct, explanation, hint? }
 *
 * Server-lah yang menilai (VRD 6.9): payload aktivitas dirakit ulang dari
 * database, divalidasi `validateActivityData`, lalu dinilai `validateAnswer`.
 * Jawaban klien tidak pernah dipercaya untuk menentukan kebenaran.
 *
 * Keamanan: prefix `/api/activity` dijaga middleware (VRD 3.5) + `parentIdOf`
 * (3.8) + `getChildForParent` (3.7); sesi wajib milik anak yang sama dan bukan
 * sesi baseline; permintaan pembuat-perubahan memeriksa Origin; body 8 KB.
 * Tanpa label lulus/gagal (PRD §9, VRD 8.6).
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { getChildForParent } from "../../../lib/auth/guard.ts";
import { getPublishedActivityById } from "../../../lib/activity/api.ts";
import { buildActivityData, loadActivityOptions } from "../../../lib/activity/content.ts";
import { validateAnswer, type ActivityType } from "../../../lib/activity/domain.ts";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../../../lib/auth/http.ts";

const ACTIVITY_TYPES = new Set([
  "TAP_ANSWER",
  "COUNT_OBJECTS",
  "MATCH",
  "SEQUENCE",
  "IDENTIFY_COLOR",
  "IDENTIFY_SHAPE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
]);

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
  const activityId = typeof parsed.activityId === "string" ? parsed.activityId : "";
  const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
  if (!childId || !activityId || !sessionId || parsed.answer === undefined) {
    return errorResponse(400, "BAD_REQUEST", "childId, activityId, sessionId, dan answer wajib diisi");
  }

  const durationMs =
    typeof parsed.durationMs === "number" &&
    Number.isFinite(parsed.durationMs) &&
    parsed.durationMs >= 0 &&
    parsed.durationMs <= 24 * 60 * 60 * 1000
      ? Math.round(parsed.durationMs)
      : null;

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  // Sesi wajib milik anak ini dan bukan sesi baseline (baseline punya
  // penanda started_at = ended_at dan punya endpoint sendiri).
  const session = await db.query<{ child_id: string; is_baseline: boolean }>(
    `SELECT child_id, COALESCE(started_at = ended_at, false) AS is_baseline
       FROM learning_session
      WHERE id = $1::uuid`,
    [sessionId],
  );
  if (session.rows.length === 0 || session.rows[0].child_id !== childId) {
    return errorResponse(400, "BAD_REQUEST", "Sesi tidak valid");
  }
  if (session.rows[0].is_baseline) {
    return errorResponse(400, "BAD_REQUEST", "Sesi asesmen dasar menerima jawaban lewat endpointnya sendiri");
  }

  const activity = await getPublishedActivityById(db, activityId);
  if (!activity) {
    return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan");
  }
  if (child.age < activity.targetAgeMin || child.age > activity.targetAgeMax) {
    return errorResponse(400, "BAD_REQUEST", "Aktivitas tidak sesuai usia anak");
  }
  if (!ACTIVITY_TYPES.has(activity.interactionType)) {
    return errorResponse(400, "BAD_REQUEST", "Tipe aktivitas tidak dikenal");
  }

  const data = buildActivityData({
    type: activity.interactionType as ActivityType,
    prompt: activity.prompt,
    correctAnswer: activity.correctAnswer,
    options: await loadActivityOptions(db, activityId),
  });
  if (!data) {
    // Gagal aman (VRD 6.14): isi belum valid/belum didukung → jangan dinilai.
    return errorResponse(400, "ACTIVITY_NOT_READY", "Aktivitas belum siap dinilai");
  }

  const verdict = validateAnswer(activity.interactionType as ActivityType, data, parsed.answer);

  const attemptNoResult = await db.query<{ next: string }>(
    `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next
       FROM activity_attempt
      WHERE child_id = $1::uuid AND activity_id = $2::uuid`,
    [childId, activityId],
  );
  const attemptNo = Number(attemptNoResult.rows[0].next);

  const attempt = await db.query<{ id: string }>(
    `INSERT INTO activity_attempt
       (child_id, session_id, activity_id, attempt_no, answer, is_correct, duration_ms)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7)
     RETURNING id`,
    [
      childId,
      sessionId,
      activityId,
      attemptNo,
      JSON.stringify(parsed.answer ?? null),
      verdict.isCorrect,
      durationMs,
    ],
  );

  await db.query(
    `INSERT INTO learning_progress (child_id, skill_id, attempts_count, correct_count, last_practiced_at)
     VALUES ($1::uuid, $2::uuid, 1, $3, now())
     ON CONFLICT (child_id, skill_id) DO UPDATE SET
       attempts_count = learning_progress.attempts_count + 1,
       correct_count = learning_progress.correct_count + EXCLUDED.correct_count,
       last_practiced_at = now(),
       updated_at = now()`,
    [childId, activity.skillId, verdict.isCorrect ? 1 : 0],
  );

  return jsonResponse(
    {
      attemptId: attempt.rows[0].id,
      attemptNo,
      correct: verdict.isCorrect,
      explanation: verdict.explanation ?? (verdict.isCorrect ? "Tepat sekali!" : "Belum tepat, coba lagi."),
      ...(verdict.hint ? { hint: verdict.hint } : {}),
    },
    201,
  );
};
