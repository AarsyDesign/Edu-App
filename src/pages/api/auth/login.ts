/**
 * VRD 3.2 — login orang tua (POST /api/auth/login).
 * Kegagalan selalu memakai kode + pesan yang sama, apa pun penyebabnya
 * (VRD 3.11: jangan membocorkan keberadaan email).
 */
import type { APIRoute } from "astro";
import { loginParent, safeMessage } from "../../../lib/auth/accounts.ts";
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
  loginRateRule,
  rateLimitResponse,
} from "../../../lib/auth/rate-limit.ts";
import { createSession } from "../../../lib/auth/session.ts";
import { getDb } from "../../../lib/db/index.ts";

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  if (!isSameOrigin(request)) {
    return errorResponse(403, "FORBIDDEN", "Permintaan ditolak.");
  }

  // 3.9 — kuota per klien+endpoint sebelum pekerjaan scrypt, sehingga
  // credential stuffing dari satu sumber dibatasi tanpa memicu hash.
  const verdict = consumeRateLimit(
    `login:${clientKey(context)}`,
    loginRateRule(),
  );
  if (!verdict.allowed) return rateLimitResponse(verdict.retryAfterSec);

  const body = await readJsonBody(request);
  if (!body) {
    return errorResponse(400, "INVALID_INPUT", safeMessage("INVALID_INPUT"));
  }

  const db = await getDb();
  const result = await loginParent(db, {
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!result.ok) {
    const status = result.code === "INVALID_INPUT" ? 400 : 401;
    return errorResponse(status, result.code, result.message);
  }

  const session = await createSession(db, result.value.parentId);
  setSessionCookie(cookies, session.token, session.expiresAt);

  return jsonResponse({
    ok: true,
    parentId: result.value.parentId,
    displayName: result.value.displayName,
  });
};
