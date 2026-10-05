/**
 * Gerbang rute (VRD 3.5).
 *
 * Middleware Astro berjalan untuk halaman DAN endpoint, jadi seluruh titik
 * masuk di `PROTECTED_PREFIXES` dicek sesinya di sini sebelum handler
 * dijalankan — termasuk endpoint profil anak yang menyusul di Phase 4.
 *
 * Tanpa sesi sah:
 * - halaman  → 303 See Other ke /login
 * - endpoint → 401 JSON `UNAUTHENTICATED`
 *
 * Sesi yang valid dititipkan ke `locals.parentSession` supaya handler tidak
 * perlu membaca cookie lagi; sumber kebenaran tetap database.
 */
import type { MiddlewareHandler } from "astro";
import { getDb } from "./lib/db/index.ts";
import { guardRequest, isProtectedPath } from "./lib/auth/guard.ts";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (!isProtectedPath(pathname)) return next();

  const db = await getDb();
  const guard = await guardRequest(db, context.cookies, context.request);
  if (!guard.allowed) return guard.response;

  context.locals.parentSession = {
    parentId: guard.session.parentId,
    sessionId: guard.session.sessionId,
    expiresAt: guard.session.expiresAt,
  };
  return next();
};
