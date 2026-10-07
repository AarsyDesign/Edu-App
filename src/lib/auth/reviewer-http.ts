/**
 * Pembantu HTTP untuk endpoint reviewer (VRD 11.1).
 *
 * Mirip parent http.ts tapi untuk reviewer_account:
 * - Cookie: `edu_reviewer_session` (HttpOnly, SameSite=Lax, Secure di produksi)
 * - Body JSON dibatasi 8 KB
 * - Respons tidak boleh di-cache
 * - Cek Origin untuk CSRF berlapis
 */
import { reviewerSessionTtlMs } from "./reviewer.ts";

export const REVIEWER_SESSION_COOKIE = "edu_reviewer_session";

export const MAX_JSON_BYTES = 8 * 1024;

export interface JsonBody {
  [key: string]: unknown;
}

/**
 * Baca body JSON. `maxBytes` boleh dinaikkan untuk endpoint tertentu (mis.
 * editor aktivitas yang membawa penjelasan + beberapa sumber) selama tetap
 * dibatasi — nilainya diperiksa dua kali: header `content-length` dan isi
 * body, supaya header yang di-spoof tidak meloloskan body raksasa.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BYTES): Promise<JsonBody | null> {
  const limit = Math.max(MAX_JSON_BYTES, maxBytes);
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > limit) return null;

  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > limit) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JsonBody;
  } catch {
    return null;
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return jsonResponse({ error: code, message }, status);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "null") return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export interface ReviewerSessionCookies {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, opts: Record<string, unknown>): void;
  delete(name: string, opts?: Record<string, unknown>): void;
}

function secureFlag(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setReviewerSessionCookie(
  cookies: ReviewerSessionCookies,
  token: string,
  expiresAt: Date,
): void {
  cookies.set(REVIEWER_SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag(),
    expires: expiresAt,
    maxAge: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function clearReviewerSessionCookie(cookies: ReviewerSessionCookies): void {
  cookies.delete(REVIEWER_SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag(),
  });
}

export function readReviewerSessionCookie(cookies: ReviewerSessionCookies): string | null {
  const raw = cookies.get(REVIEWER_SESSION_COOKIE);
  const value = raw?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function defaultReviewerSessionExpiry(): Date {
  return new Date(Date.now() + reviewerSessionTtlMs());
}