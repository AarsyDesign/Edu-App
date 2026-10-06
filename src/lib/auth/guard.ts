/**
 * Gerbang rute & otorisasi server-side (VRD 3.5–3.7).
 *
 * - 3.5  Setiap rute orang tua dicek sesinya SEBELUM halaman dirender
 *        (dipanggil `src/middleware.ts`). Tanpa sesi sah → alihkan ke /login,
 *        atau 401 JSON untuk endpoint.
 * - 3.6  API profil anak wajib melewati gerbang ini: `guardRequest()` untuk
 *        sesi, `getChildForParent()` untuk kepemilikan.
 * - 3.7  Kepemilikan selalu dicek di server dengan klausa
 *        `parent_account_id = sesi.parent_id` — tidak pernah dititipkan di
 *        klien.
 *
 * Prinsip: anak yang bukan milik akun ini dan profil yang tidak ada sama
 * sekali dibalas dengan hasil yang SAMA (`null`), sehingga id profil anak tidak
 * bisa dipakai untuk memastikan keberadaan data orang lain.
 */
import type { Db } from "../db/index.ts";
import {
  clearSessionCookie,
  errorResponse,
  readSessionCookie,
  type SessionCookies,
} from "./http.ts";
import { resolveSession, type ResolvedSession } from "./session.ts";

/** Titik masuk yang dilindungi. `"/parent"` juga menutup `/parent/...`. */
export const PROTECTED_PREFIXES = [
  "/learn",
  "/parent",
  "/api/parent",
  "/api/children",
  "/api/assessment",
  "/api/activity",
  "/api/session",
] as const;

/** Kueri `/parent` cocok; `/parents` dan `/parentx` tidak (batas segment). */
export function isProtectedPath(pathname: string): boolean {
  const path = pathname.split("?")[0].split("#")[0];
  return PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GUARD_MESSAGES = {
  unauthenticated: "Silakan masuk ke akun orang tua terlebih dahulu.",
} as const;

export type GuardResult =
  | { allowed: true; session: ResolvedSession }
  | { allowed: false; response: Response };

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location, "cache-control": "no-store" },
  });
}

/**
 * Cek sesi untuk rute terlindungi. Mengembalikan respons pengalih/penolak
 * bila belum login, sesi kedaluwarsa, atau token tidak dikenal.
 *
 * Token yang tidak sah dibersihkan dari cookie supaya peramban tidak terus
 * mengirim puing sesi (VRD 3.4).
 */
export async function guardRequest(
  db: Db,
  cookies: SessionCookies,
  request: Request,
): Promise<GuardResult> {
  const { pathname } = new URL(request.url);
  const token = readSessionCookie(cookies);
  const session = token ? await resolveSession(db, token) : null;

  if (session) return { allowed: true, session };

  if (token) clearSessionCookie(cookies);

  // Halaman → alihkan ke login. Endpoint → jawab JSON 401 (klien tipe ini
  // tidak bisa memakai hasil halaman login).
  if (pathname.startsWith("/api/")) {
    return {
      allowed: false,
      response: errorResponse(401, "UNAUTHENTICATED", GUARD_MESSAGES.unauthenticated),
    };
  }
  return { allowed: false, response: redirectResponse("/login") };
}

/** Profil anak yang diizinkan untuk dibaca/diubah oleh sesi berjalan. */
export interface ChildRecord {
  childId: string;
  parentAccountId: string;
  nickname: string;
  age: number;
  avatarKey: string | null;
  language: string;
  learningGoals: string[];
  archivedAt: Date | null;
}

/**
 * VRD 3.7 — ambil profil anak HANYA bila dimiliki oleh `parentId`.
 *
 * Mengembalikan `null` bila: id bukan uuid yang valid, profil tidak ada,
 * atau profil milik orang tua lain. Pemanggil merespons 404/401 yang sama
 * untuk ketiganya supaya tidak ada indikator keberadaan data.
 *
 * `archived_at` ikut dikembalikan — keputusan arsip/bukan urusan gerbang ini.
 */
export async function getChildForParent(
  db: Db,
  childId: string,
  parentId: string,
): Promise<ChildRecord | null> {
  if (typeof childId !== "string" || !UUID_RE.test(childId)) return null;
  if (typeof parentId !== "string" || !UUID_RE.test(parentId)) return null;

  const rows = await db.query<{
    id: string;
    parent_account_id: string;
    nickname: string;
    age: number;
    avatar_key: string | null;
    language: string;
    learning_goals: string[];
    archived_at: Date | null;
  }>(
    `SELECT id, parent_account_id, nickname, age, avatar_key,
            language, learning_goals, archived_at
       FROM child_profile
      WHERE id = $1::uuid
        AND parent_account_id = $2::uuid`,
    [childId, parentId],
  );
  const row = rows.rows[0];
  if (!row) return null;
  return {
    childId: row.id,
    parentAccountId: row.parent_account_id,
    nickname: row.nickname,
    age: row.age,
    avatarKey: row.avatar_key,
    language: row.language,
    learningGoals: row.learning_goals ?? [],
    archivedAt: row.archived_at,
  };
}
