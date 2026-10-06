/**
 * POST /api/reviewer/auth/login — Login reviewer (VRD 11.1).
 *
 * Mirip parent login tapi untuk reviewer_account:
 * - Body JSON: { email, password }
 * - Hash password dicek via verifyReviewerPassword (scrypt PBKDF2)
 * - Sesi dibuat via createReviewerSession, cookie HttpOnly dipasang
 * - Rate limiting per IP (endpoint terpisah dari parent)
 * - CSRF: cek Origin, body dibatasi 8 KB, respons no-store
 * - Tanpa oracle email (VRD 3.11): email tidak ditemukan = kata sandi salah
 *   (verifikasi tetap dijalankan terhadap hash dummy supaya timing seragam)
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db/index.ts";
import { readJsonBody, jsonResponse, errorResponse, isSameOrigin, setReviewerSessionCookie } from "../../../../lib/auth/reviewer-http.ts";
import { getReviewerByEmail, verifyReviewerPassword, createReviewerSession } from "../../../../lib/auth/reviewer.ts";
import { checkRateLimit, RATE_LIMIT_KEYS } from "../../../../lib/auth/rate-limit.ts";

const DUMMY_HASH = "scrypt$16384$8$1$" + "0".repeat(32) + "$" + "0".repeat(64);

export const POST: APIRoute = async ({ request, cookies }) => {
  // CSRF berlapis: cek Origin SEBELUM rate limit
  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  // Rate limit: 15 percobaan / 15 menit per IP (override via env)
  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_LOGIN);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const body = await readJsonBody(request);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return errorResponse(400, "BAD_REQUEST", "Email dan kata sandi wajib diisi.");
  }

  const db = await getDb();
  const reviewer = await getReviewerByEmail(db, email);

  // Timing-safe: selalu verifikasi hash (dummy bila reviewer tidak ada)
  const hashToVerify = reviewer?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyReviewerPassword(password, hashToVerify);

  if (!reviewer || !passwordOk) {
    return errorResponse(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.");
  }

  // Buat sesi reviewer
  const { token, expiresAt } = await createReviewerSession(db, reviewer.id);
  setReviewerSessionCookie(cookies, token, expiresAt);

  return jsonResponse({ ok: true, message: "Masuk berhasil." });
}