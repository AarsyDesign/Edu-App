/**
 * POST /api/reviewer/aktivitas/:id/status — transisi status review (VRD 11.11).
 *
 * Body: `{ to_status, notes? }`.
 *
 * Aturan:
 * - Matriks transisi hanya dari `review-flow.ts` (PRD §7); transisi di luar
 *   matriks → 409 `INVALID_TRANSITION` (VRD 11.13: penerbitan hanya dari
 *   `QA_APPROVED`).
 * - Satu-satunya jalur tulis status = INSERT ke `content_review`; trigger
 *   migrasi 0001 menyalinnya ke `activity.review_status` dan trigger migrasi
 *   0005 memvalidasi `from_status` terhadap status aktivitas yang sebenarnya
 *   sehingga transisi tidak bisa dilewati oleh kode mana pun.
 * - Penulisan memakai `INSERT ... WHERE` berbasis status saat ini, jadi dua
 *   permintaan bersamaan tidak bisa melompati giliran (yang kalah → 409
 *   `STATUS_CHANGED`).
 *
 * Rute berada di balik guard reviewer middleware (VRD 11.1).
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../../../lib/db/index.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  isSameOrigin,
} from "../../../../../lib/auth/reviewer-http.ts";
import {
  checkRateLimit,
  RATE_LIMIT_KEYS,
} from "../../../../../lib/auth/rate-limit.ts";
import { reviewerIdOf } from "../../../../../lib/auth/reviewer-guard.ts";
import {
  getReviewStatusLabel,
  getReviewerActivityDetail,
} from "../../../../../lib/activity/reviewer.ts";
import {
  allowedTransitions,
  canTransition,
  isReviewStatus,
  parseReviewNotes,
} from "../../../../../lib/activity/review-flow.ts";

const STATUS_MAX_BYTES = 4 * 1024;

export const POST: APIRoute = async (context) => {
  const { request, params } = context;

  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_WRITE);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const reviewerId = reviewerIdOf(context);
  if (reviewerId instanceof Response) return reviewerId;

  const activityId = params.id ?? "";
  if (!activityId) return errorResponse(400, "BAD_REQUEST", "Id aktivitas wajib diisi.");

  const body = await readJsonBody(request, STATUS_MAX_BYTES);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");

  const rawTarget = typeof body.to_status === "string" ? body.to_status.trim().toUpperCase() : "";
  if (!rawTarget) return errorResponse(400, "BAD_REQUEST", "Status tujuan wajib diisi.");
  if (!isReviewStatus(rawTarget)) {
    return errorResponse(400, "BAD_REQUEST", "Status tujuan tidak dikenal.");
  }

  const notes = parseReviewNotes(body.notes);
  if (!notes.ok) return errorResponse(400, "BAD_REQUEST", notes.message);

  const db = await getDb();
  const detail = await getReviewerActivityDetail(db, activityId);
  if (!detail) return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");

  const from = detail.activity.reviewStatus;
  if (!isReviewStatus(from)) {
    return errorResponse(409, "INVALID_TRANSITION", "Status aktivitas tidak dikenal.");
  }
  if (from === rawTarget) {
    return errorResponse(
      409,
      "INVALID_TRANSITION",
      `Status sudah ${getReviewStatusLabel(from)}. Pilih langkah lain.`,
    );
  }
  if (!canTransition(from, rawTarget)) {
    const options = allowedTransitions(from)
      .map((t) => `${t.label} → ${getReviewStatusLabel(t.to)}`)
      .join("; ");
    return errorResponse(
      409,
      "INVALID_TRANSITION",
      `Transisi ${getReviewStatusLabel(from)} → ${getReviewStatusLabel(rawTarget)} tidak diizinkan alur konten. Pilihan: ${options}.`,
    );
  }

  // Tulis atomik: baris hanya masuk bila status aktivitas masih persis `from`
  // saat ini dibaca — permintaan yang kalah mendapat 409, bukan lompatan diam-diam.
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO content_review (activity_id, from_status, to_status, notes, reviewer)
     SELECT $1::uuid, $2::content_review_status, $3::content_review_status, $4, $5::uuid
      WHERE EXISTS (
        SELECT 1 FROM activity
         WHERE id = $1::uuid AND review_status = $2::content_review_status
      )
     RETURNING id`,
    [activityId, from, rawTarget, notes.notes, reviewerId],
  );

  if (inserted.rows.length === 0) {
    return errorResponse(
      409,
      "STATUS_CHANGED",
      "Status aktivitas berubah sejak halaman dibuka. Muat ulang halaman lalu ulangi.",
    );
  }

  return jsonResponse({
    ok: true,
    reviewStatus: rawTarget,
    message: `${getReviewStatusLabel(from)} → ${getReviewStatusLabel(rawTarget)} tercatat di riwayat review.`,
  });
};
