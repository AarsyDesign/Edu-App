/**
 * Gerbang rute gabungan (VRD 3.5 + 11.1).
 *
 * Middleware Astro berjalan untuk halaman DAN endpoint.
 * - Prefiks parent → guard parent (sudah ada)
 * - Prefiks reviewer → guard reviewer (Phase 11)
 *
 * Tanpa sesi sah:
 * - halaman  → 303 See Other ke /login (parent) atau /reviewer/login (reviewer)
 * - endpoint → 401 JSON `UNAUTHENTICATED`
 *
 * Sesi yang valid dititipkan ke `locals.parentSession` / `locals.reviewerSession`
 * supaya handler tidak perlu membaca cookie lagi; sumber kebenaran tetap database.
 */
import type { MiddlewareHandler } from "astro";
import { getDb } from "./lib/db/index.ts";
import { guardRequest, isProtectedPath } from "./lib/auth/guard.ts";
import { guardReviewerRequest, isReviewerProtectedPath } from "./lib/auth/reviewer-guard.ts";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Cek rute parent dulu
  if (isProtectedPath(pathname)) {
    const db = await getDb();
    const guard = await guardRequest(db, context.cookies, context.request);
    if (!guard.allowed) return guard.response;

    context.locals.parentSession = {
      parentId: guard.session.parentId,
      sessionId: guard.session.sessionId,
      expiresAt: guard.session.expiresAt,
    };
    return next();
  }

  // Cek rute reviewer
  if (isReviewerProtectedPath(pathname)) {
    const db = await getDb();
    const guard = await guardReviewerRequest(db, context.cookies, context.request);
    if (!guard.allowed) return guard.response;

    context.locals.reviewerSession = {
      reviewerId: guard.session.reviewerId,
      expiresAt: guard.session.expiresAt,
    };
    return next();
  }

  // Rute publik diteruskan tanpa cek sesi
  return next();
};