/**
 * VRD 3.1 — registrasi akun orang tua (POST /api/auth/register).
 * Berhasil = sesi langsung terpasang di cookie HttpOnly, sehingga klien tidak
 * pernah menyimpan kredensial apa pun (SECURITY-PRIVACY).
 */
import type { APIRoute } from "astro";
import { registerParent, safeMessage } from "../../../lib/auth/accounts.ts";
import {
  errorResponse,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
  setSessionCookie,
} from "../../../lib/auth/http.ts";
import {
  clientKey,
  consumeRateLimit,
  rateLimitResponse,
  registerRateRule,
} from "../../../lib/auth/rate-limit.ts";
import { createSession } from "../../../lib/auth/session.ts";
import { getDb } from "../../../lib/db/index.ts";

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  if (!isSameOrigin(request)) {
    return errorResponse(403, "FORBIDDEN", "Permintaan ditolak.");
  }

  // 3.9 — kuota per klien+endpoint; mencegah pendaftaran massal sekaligus
  // membatasi enumerasi email lewat balasan 409 (lihat OQ 8).
  const verdict = consumeRateLimit(
    `register:${clientKey(context)}`,
    registerRateRule(),
  );
  if (!verdict.allowed) return rateLimitResponse(verdict.retryAfterSec);

  const body = await readJsonBody(request);
  if (!body) {
    return errorResponse(400, "INVALID_INPUT", safeMessage("INVALID_INPUT"));
  }

  const db = await getDb();
  const result = await registerParent(db, {
    email: typeof body.email === "string" ? body.email : "",
    displayName: typeof body.displayName === "string" ? body.displayName : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!result.ok) {
    const status = result.code === "EMAIL_TAKEN" ? 409 : 400;
    return errorResponse(status, result.code, result.message);
  }

  const session = await createSession(db, result.value.parentId);
  setSessionCookie(cookies, session.token, session.expiresAt);

  return jsonResponse(
    {
      ok: true,
      parentId: result.value.parentId,
      displayName: result.value.displayName,
    },
    201,
  );
};
