/**
 * VRD 3.3 — logout (POST /api/auth/logout).
 * Idempoten: tanpa sesi tetap dijawab 200 agar tombol logout tidak pernah
 * memunculkan keadaan galat ke pengguna.
 */
import type { APIRoute } from "astro";
import { isSameOrigin, clearSessionCookie, jsonResponse, readSessionCookie } from "../../../lib/auth/http.ts";
import { revokeSession } from "../../../lib/auth/session.ts";
import { getDb } from "../../../lib/db/index.ts";

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request)) {
    return jsonResponse({ ok: false }, 403);
  }

  const token = readSessionCookie(cookies);
  if (token) {
    const db = await getDb();
    await revokeSession(db, token);
  }
  clearSessionCookie(cookies);

  return jsonResponse({ ok: true });
};
