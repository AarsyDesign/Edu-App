/**
 * GET    /api/reviewer/aktivitas/:id — detail aktivitas + opsi + sumber
 *        untuk layar edit (VRD 11.2, 11.9, 11.12).
 * PUT    /api/reviewer/aktivitas/:id — simpan hasil edit (VRD 11.2–11.10).
 *        Formulir selalu mengirim isi lengkap; `review_status` TIDAK pernah
 *        diubah oleh endpoint ini.
 * DELETE /api/reviewer/aktivitas/:id — hapus aktivitas yang masih DRAFT saja
 *        (VRD 11.13).
 *
 * Rute berada di balik guard reviewer middleware (VRD 11.1).
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
  EDITABLE_REVIEW_STATUSES,
  getReviewerActivityDetail,
  parseEditorPayload,
  replaceActivityOptions,
  replaceActivitySources,
  resolveSkillForArea,
} from "../../../../lib/activity/reviewer.ts";
import { listReviewHistory } from "../../../../lib/activity/review-flow.ts";

const EDITOR_MAX_BYTES = 32 * 1024;

export const GET: APIRoute = async ({ params }) => {
  const activityId = params.id ?? "";
  if (!activityId) return errorResponse(400, "BAD_REQUEST", "Id aktivitas wajib diisi.");

  const db = await getDb();
  const detail = await getReviewerActivityDetail(db, activityId);
  if (!detail) return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");

  // Riwayat transisi status (VRD 11.11) ikut disertakan supaya QA lewat HTTP
  // bisa memeriksa jejak provenance tanpa akses langsung ke database.
  const history = await listReviewHistory(db, activityId);
  return jsonResponse({ ...detail, history });
};

export const PUT: APIRoute = async ({ request, params }) => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_WRITE);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const activityId = params.id ?? "";
  if (!activityId) return errorResponse(400, "BAD_REQUEST", "Id aktivitas wajib diisi.");

  const body = await readJsonBody(request, EDITOR_MAX_BYTES);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");

  const parsed = parseEditorPayload(body);
  if (!parsed.ok) return errorResponse(400, "BAD_REQUEST", parsed.message);
  const payload = parsed.payload;

  const db = await getDb();
  const current = await getReviewerActivityDetail(db, activityId);
  if (!current) return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");

  // Konten yang sedang direview / tayang dikunci supaya persetujuan tidak
  // bisa dilewati lewat edit diam-diam (PRD §7, VRD 11.13).
  const status = current.activity.reviewStatus;
  if (!EDITABLE_REVIEW_STATUSES.includes(status)) {
    return errorResponse(
      409,
      "STATUS_LOCKED",
      "Konten yang sedang dalam review atau sudah tayang tidak bisa diedit langsung. Ubah statusnya lewat alur review dulu.",
    );
  }

  const resolved = await resolveSkillForArea(db, {
    learningAreaId: payload.learningAreaId,
    skillId: payload.skillId,
  });
  if (!resolved.ok) return errorResponse(400, "BAD_REQUEST", resolved.message);

  await db.query(
    `UPDATE activity
        SET skill_id = $2::uuid,
            learning_area_id = $3::uuid,
            target_age_min = $4,
            target_age_max = $5,
            difficulty = $6,
            prompt = $7,
            interaction_type = $8::activity_type,
            correct_answer = $9,
            explanation = $10,
            content_origin = $11::content_origin,
            version = version + 1
      WHERE id = $1::uuid`,
    [
      activityId,
      resolved.skillId,
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

  await replaceActivityOptions(db, activityId, payload.interactionType, payload.correctAnswer);
  await replaceActivitySources(db, activityId, payload.sources);

  return jsonResponse({ ok: true, reviewStatus: status, message: "Perubahan tersimpan." });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_WRITE);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const activityId = params.id ?? "";
  if (!activityId) return errorResponse(400, "BAD_REQUEST", "Id aktivitas wajib diisi.");

  const db = await getDb();
  const detail = await getReviewerActivityDetail(db, activityId);
  if (!detail) return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");

  // Hanya DRAFT: aktivitas yang pernah melewati review tidak dihapus diam-diam
  // (riwayat review & jejak provenance harus tetap terbaca, VRD 11.13).
  if (detail.activity.reviewStatus !== "DRAFT") {
    return errorResponse(
      400,
      "BAD_REQUEST",
      "Hanya draf yang bisa dihapus. Aktivitas lain diubah statusnya menjadi tidak terbit lewat alur review.",
    );
  }

  await db.query(`DELETE FROM activity WHERE id = $1::uuid`, [activityId]);
  // activity_option, content_source, dan content_review ikut terhapus (FK ON DELETE CASCADE).

  return jsonResponse({ ok: true, message: "Aktivitas dihapus." });
};
