/**
 * Pembantu HTTP untuk endpoint autentikasi (VRD 3.1–3.4, 3.8, 3.10).
 *
 * - Body JSON dibatasi ukurannya (kebocoran memori / DoS kecil).
 * - Respons auth tidak boleh di-cache (berisi status sesi).
 * - Cek Origin untuk permintaan pembuat-perubahan: pelindung CSRF berlapis
 *   bersama SameSite=Lax (SECURITY-PRIVACY: CSRF protection).
 * - Pesan error selalu generik, tanpa detail internal (VRD 3.10).
 */
import { SESSION_COOKIE, sessionTtlMs } from "./session.ts";

export const MAX_JSON_BYTES = 8 * 1024;

export interface JsonBody {
  [key: string]: unknown;
}

/** Baca body JSON; `null` bila kosong/rusak/kebesaran (bukan exception). */
export async function readJsonBody(request: Request): Promise<JsonBody | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_JSON_BYTES) return null;

  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > MAX_JSON_BYTES) return null;

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

/**
 * Tolak permintaan lintas-asal bila header Origin ada dan tidak cocok.
 * (Permintaan tanpa Origin = klien non-peramban; cookie SameSite=Lax sudah
 * menahan POST lintas-asal dari peramban.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null || origin === "null") return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export interface SessionCookies {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, opts: Record<string, unknown>): void;
  delete(name: string, opts?: Record<string, unknown>): void;
}

function secureFlag(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Pasang cookie sesi: HttpOnly, SameSite=Lax, Path=/, Secure di produksi. */
export function setSessionCookie(
  cookies: SessionCookies,
  token: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag(),
    expires: expiresAt,
    maxAge: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export function clearSessionCookie(cookies: SessionCookies): void {
  cookies.delete(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag(),
  });
}

export function readSessionCookie(cookies: SessionCookies): string | null {
  const raw = cookies.get(SESSION_COOKIE);
  const value = raw?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Kedaluwarsa sesi untuk cookie — dipakai saat membangun ulang cookie. */
export function defaultSessionExpiry(): Date {
  return new Date(Date.now() + sessionTtlMs());
}
