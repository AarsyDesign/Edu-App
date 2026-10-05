/**
 * POST /api/session/start — Mulai sesi belajar baru (VRD Phase 7.6).
 * Body: { childId, activityId, learningAreaId }
 * Response: { sessionId, activity }
 * Validasi: child milik parent (via middleware), activity published & cocok usia.
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { getChildForParent } from "../../../lib/auth/guard.ts";
import { getPublishedActivityById } from "../../../lib/activity/api.ts";
import { errorResponse } from "../../../lib/auth/http.ts";

export const POST: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const db = await getDb();

  let body: { childId: string; activityId: string; learningAreaId: string };
  try {
    body = await context.request.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Body harus JSON valid");
  }

  const { childId, activityId, learningAreaId } = body;
  if (!childId || !activityId || !learningAreaId) {
    return errorResponse(400, "BAD_REQUEST", "childId, activityId, learningAreaId wajib diisi");
  }

  // Verifikasi kepemilikan anak
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  // Ambil aktivitas (sudah memastikan PUBLISHED & area aktif)
  const activity = await getPublishedActivityById(db, activityId);
  if (!activity) {
    return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan atau belum dipublikasikan");
  }

  // Verifikasi learningAreaId cocok
  if (activity.learningAreaId !== learningAreaId) {
    return errorResponse(400, "BAD_REQUEST", "learningAreaId tidak cocok dengan aktivitas");
  }

  // Verifikasi usia anak cocok
  if (child.age < activity.targetAgeMin || child.age > activity.targetAgeMax) {
    return errorResponse(400, "BAD_REQUEST", "Aktivitas tidak sesuai usia anak");
  }

  // Buat sesi baru
  const sessionResult = await db.query<{ id: string }>(
    `INSERT INTO learning_session (child_id, started_at)
       VALUES ($1::uuid, now())
       RETURNING id`,
    [childId],
  );

  const sessionId = sessionResult.rows[0].id;

  return new Response(
    JSON.stringify({
      sessionId,
      activity: {
        activityId: activity.activityId,
        skillId: activity.skillId,
        learningAreaId: activity.learningAreaId,
        learningAreaTitle: activity.learningAreaTitle,
        prompt: activity.prompt,
        interactionType: activity.interactionType,
        correctAnswer: activity.correctAnswer,
        explanation: activity.explanation,
        difficulty: activity.difficulty,
      },
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};