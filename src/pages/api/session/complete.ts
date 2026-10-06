/**
 * POST /api/session/complete — tutup sesi belajar (VRD 7.7).
 *
 * Body: { sessionId } → 200 { sessionId, endedAt }.
 * Idempoten: sesi yang sudah tertutup tidak diubah, balasan tetap sama.
 *
 * Keamanan: prefix `/api/session` dijaga middleware + `parentIdOf` + sesi
 * wajib milik anak dari sesi orang tua yang sama; permintaan pembuat-perubahan
 * memeriksa Origin.
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { getChildForParent } from "../../../lib/auth/guard.ts";
import { completeLearningSession, sessionBelongsToChild } from "../../../lib/progress/sessions.ts";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../../../lib/auth/http.ts";

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

  const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
  const childId = typeof parsed.childId === "string" ? parsed.childId : "";
  if (!sessionId || !childId) {
    return errorResponse(400, "BAD_REQUEST", "sessionId dan childId wajib diisi");
  }

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }
  if (!(await sessionBelongsToChild(db, sessionId, childId))) {
    return errorResponse(400, "BAD_REQUEST", "Sesi tidak valid");
  }

  const result = await completeLearningSession(db, sessionId);
  if (!result) {
    return errorResponse(400, "BAD_REQUEST", "Sesi tidak valid");
  }

  return jsonResponse({ sessionId, endedAt: result.endedAt.toISOString() });
};
