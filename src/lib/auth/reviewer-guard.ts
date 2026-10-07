/**
 * Gerbang rute reviewer/konten (VRD 11.1).
 *
 * Mirip guard parent tapi untuk reviewer_account:
 * - Cookie: `edu_reviewer_session` (HttpOnly, SameSite=Lax, Secure di produksi)
 * - Tanpa sesi sah: halaman → 303 /reviewer/login, endpoint → 401 JSON
 * - Sesi valid dititipkan ke `locals.reviewerSession`
 * - Proteksi lintas-asal (CSRF berlapis) sama seperti parent
 */
import type { APIContext, MiddlewareHandler } from "astro";
import { getDb, type Db } from "../../lib/db/index.ts";
import {
  clearReviewerSessionCookie,
  errorResponse,
  readReviewerSessionCookie,
  type ReviewerSessionCookies,
} from "./reviewer-http.ts";
import { resolveReviewerSession, type ReviewerAccount } from "./reviewer.ts";

/** Prefiks yang dilindungi reviewer. */
export const REVIEWER_PROTECTED_PREFIXES = [
  "/reviewer",
  "/api/reviewer",
] as const;

/**
 * Rute publik di bawah prefiks terlindungi — tanpa daftar ini halaman login
 * me-redirect ke dirinya sendiri dan endpoint login selalu 401, sehingga
 * tidak ada cara masuk sama sekali (ditemukan saat QA E2E VRD 11.2).
 */
export const REVIEWER_PUBLIC_PATHS = [
  "/reviewer/login",
  "/api/reviewer/auth/login",
] as const;

export function isReviewerPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0].split("#")[0].replace(/\/$/, "");
  return REVIEWER_PUBLIC_PATHS.some((publicPath) => path === publicPath);
}

export function isReviewerProtectedPath(pathname: string): boolean {
  if (isReviewerPublicPath(pathname)) return false;
  const path = pathname.split("?")[0].split("#")[0];
  return REVIEWER_PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export const REVIEWER_GUARD_MESSAGES = {
  unauthenticated: "Silakan masuk ke akun reviewer terlebih dahulu.",
} as const;

/**
 * Ambil reviewer dari sesi middleware (`locals.reviewerSession`), bukan dari
 * body/kueri klien — pola yang sama dengan `parentIdOf()` (VRD 3.8).
 * `Response` 401 bila sesi tidak ada di konteks.
 */
export function reviewerIdOf(context: APIContext): string | Response {
  const reviewerId = context.locals.reviewerSession?.reviewerId;
  if (typeof reviewerId !== "string" || reviewerId.length === 0) {
    return errorResponse(401, "UNAUTHENTICATED", REVIEWER_GUARD_MESSAGES.unauthenticated);
  }
  return reviewerId;
}

export type ReviewerGuardResult =
  | { allowed: true; session: { reviewerId: string; sessionId: string; expiresAt: Date } }
  | { allowed: false; response: Response };

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location, "cache-control": "no-store" },
  });
}

export async function guardReviewerRequest(
  db: Db,
  cookies: ReviewerSessionCookies,
  request: Request,
): Promise<ReviewerGuardResult> {
  const { pathname } = new URL(request.url);
  const token = readReviewerSessionCookie(cookies);
  const reviewerId = token ? await resolveReviewerSession(db, token) : null;

  if (reviewerId) {
    return { allowed: true, session: { reviewerId, sessionId: "", expiresAt: new Date() } };
  }

  if (token) clearReviewerSessionCookie(cookies);

  if (pathname.startsWith("/api/")) {
    return {
      allowed: false,
      response: errorResponse(401, "UNAUTHENTICATED", REVIEWER_GUARD_MESSAGES.unauthenticated),
    };
  }
  return { allowed: false, response: redirectResponse("/reviewer/login") };
}

/** Middleware Astro untuk rute reviewer. */
export const onReviewerRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (!isReviewerProtectedPath(pathname)) return next();

  const db = await getDb();
  const guard = await guardReviewerRequest(db, context.cookies, context.request);
  if (!guard.allowed) return guard.response;

  context.locals.reviewerSession = {
    reviewerId: guard.session.reviewerId,
    expiresAt: guard.session.expiresAt,
  };
  return next();
};