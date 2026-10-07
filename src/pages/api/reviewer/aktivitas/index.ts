/**
 * GET  /api/reviewer/aktivitas — daftar aktivitas untuk reviewer (VRD 11.2).
 *      Query: ?area=<code>&status=<REVIEW_STATUS>&page=1&limit=20
 * POST /api/reviewer/aktivitas — buat aktivitas baru (VRD 11.2, seluruh
 *      field editor 11.3–11.10). Selalu lahir sebagai DRAFT: perubahan
 *      status hanya lewat jejak `content_review` (VRD 11.11/11.13).
 *
 * Rute berada di balik guard reviewer middleware (VRD 11.1) — sesi reviewer
 * sudah dicek sebelum handler ini dijalankan.
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db/index.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  isSameOrigin,
} from "../../../../lib/auth/reviewer-http.ts";
import {
  checkRateLimit,
  RATE_LIMIT_KEYS,
} from "../../../../lib/auth/rate-limit.ts";
import {
  countReviewerActivities,
  listReviewerActivities,
  parseEditorPayload,
  replaceActivityOptions,
  replaceActivitySources,
  resolveSkillForArea,
} from "../../../../lib/activity/reviewer.ts";

/** Editor boleh membawa penjelasan + beberapa sumber → batas di atas 8 KB. */
const EDITOR_MAX_BYTES = 32 * 1024;
const LIST_DEFAULT_LIMIT = 20;
const LIST_MAX_LIMIT = 50;

function parseIntClamped(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const areaCode = url.searchParams.get("area");
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw ? statusRaw.toUpperCase() : null;
  const page = parseIntClamped(url.searchParams.get("page"), 1, 1, 1000);
  const limit = parseIntClamped(
    url.searchParams.get("limit"),
    LIST_DEFAULT_LIMIT,
    1,
    LIST_MAX_LIMIT,
  );

  const options = { areaCode, status, page, limit };
  const db = await getDb();
  const total = await countReviewerActivities(db, options);
  const activities = await listReviewerActivities(db, options);

  return jsonResponse({
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  // CSRF berlapis: cek Origin sebelum bekerja apa pun.
  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_WRITE);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const body = await readJsonBody(request, EDITOR_MAX_BYTES);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");

  const parsed = parseEditorPayload(body);
  if (!parsed.ok) return errorResponse(400, "BAD_REQUEST", parsed.message);
  const payload = parsed.payload;

  const db = await getDb();

  const resolved = await resolveSkillForArea(db, {
    learningAreaId: payload.learningAreaId,
    skillId: payload.skillId,
  });
  if (!resolved.ok) return errorResponse(400, "BAD_REQUEST", resolved.message);
  const skillId = resolved.skillId;

  const created = await db.query<{ id: string }>(
    `INSERT INTO activity (
       skill_id, learning_area_id, target_age_min, target_age_max, difficulty,
       prompt, interaction_type, correct_answer, explanation, content_origin, review_status
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT')
     RETURNING id`,
    [
      skillId,
      payload.learningAreaId,
      payload.targetAgeMin,
      payload.targetAgeMax,
      payload.difficulty,
      payload.prompt,
      payload.interactionType,
      JSON.stringify(payload.correctAnswer),
      payload.explanation,
      payload.contentOrigin,
    ],
  );

  const activityId = created.rows[0]?.id;
  if (!activityId) return errorResponse(500, "SERVER_ERROR", "Gagal membuat aktivitas.");

  await replaceActivityOptions(db, activityId, payload.interactionType, payload.correctAnswer);
  await replaceActivitySources(db, activityId, payload.sources);

  return jsonResponse({
    ok: true,
    activityId,
    reviewStatus: "DRAFT",
    message: "Aktivitas tersimpan sebagai draf.",
  });
};
