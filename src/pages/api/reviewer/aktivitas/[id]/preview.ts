/**
 * POST /api/reviewer/aktivitas/:id/preview — nilai jawaban untuk pratinjau
 * anak (VRD 11.12).
 *
 * Body: `{ answer, durationMs? }` → 200 `{ preview: true, correct,
 * explanation, hint? }`.
 *
 * Aturan:
 * - Penilaian memakai `buildActivityData` + `validateAnswer` — aturan yang
 *   sama dengan `/api/activity/attempt` (VRD 6.9), sehingga umpan balik di
 *   pratinjau = umpan balik produksi (acceptance 11.12).
 * - TANPA tulis apa pun: tidak ada `learning_session`, `activity_attempt`,
 *   maupun `learning_progress` yang disentuh — pratinjau tidak pernah
 *   mencemari data anak (PRD §8).
 * - Aktivitas boleh berstatus apa pun (termasuk DRAFT) selama bisa dirakit;
 *   yang menilai tetap reviewer yang sudah masuk (VRD 11.1).
 * - Rute berada di balik guard reviewer middleware (VRD 11.1).
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
import { getReviewerActivityDetail } from "../../../../../lib/activity/reviewer.ts";
import { buildActivityData } from "../../../../../lib/activity/content.ts";
import { validateAnswer, type ActivityType } from "../../../../../lib/activity/domain.ts";
import { feedbackExplanation } from "../../../../../lib/activity/feedback.ts";

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

  const body = await readJsonBody(request);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");
  if (body.answer === undefined) {
    return errorResponse(400, "BAD_REQUEST", "Jawaban wajib diisi.");
  }

  const db = await getDb();
  const detail = await getReviewerActivityDetail(db, activityId);
  if (!detail) return errorResponse(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");

  const type = detail.activity.interactionType as ActivityType;
  const data = buildActivityData({
    type,
    prompt: detail.activity.prompt,
    correctAnswer: detail.activity.correctAnswer,
    options: detail.options,
  });
  if (!data) {
    // Gagal aman (VRD 6.14): isi tidak bisa dirakit → jangan dinilai.
    return errorResponse(400, "ACTIVITY_NOT_READY", "Aktivitas belum siap dinilai.");
  }

  const verdict = validateAnswer(type, data, body.answer);

  return jsonResponse({
    preview: true,
    correct: verdict.isCorrect,
    // Pratinjau = umpan balik produksi (acceptance 11.12): penjelasan konten
    // lebih dulu, lalu teks generik mesin penilaian.
    explanation: feedbackExplanation(
      detail.activity.explanation,
      verdict.explanation,
      verdict.isCorrect,
    ),
    ...(verdict.hint ? { hint: verdict.hint } : {}),
  });
};
