/**
 * Sesi login orang tua (VRD 3.3 logout, 3.4 kedaluwarsa sesi).
 *
 * Token mentah = 32 byte acak (base64url), hanya hidup di cookie HttpOnly.
 * Yang disimpan di database = SHA-256 hex token, sehingga kebocoran tabel
 * sesi tidak serta-merta membocorkan sesi aktif.
 *
 * Kedaluwarsa bersifat absolut (bukan geser): PRD/VRD tidak menentukan durasi,
 * jadi dipakai default 14 hari yang bisa dioverride lewat env SESSION_TTL_DAYS.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/index.ts";

/** Nama cookie sesi. HttpOnly + SameSite=Lax + Path=/. */
export const SESSION_COOKIE = "edu_session";

const DEFAULT_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Durasi sesi dalam ms; env SESSION_TTL_DAYS (positif) menimpa default. */
export function sessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_DAYS;
  if (raw !== undefined && raw.trim() !== "") {
    const days = Number(raw);
    if (Number.isFinite(days) && days > 0) return Math.floor(days * DAY_MS);
  }
  return DEFAULT_TTL_DAYS * DAY_MS;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface CreatedSession {
  /** Hanya dikirim ke klien (cookie) — jangan dicatat ke log. */
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export interface ResolvedSession {
  sessionId: string;
  parentId: string;
  expiresAt: Date;
}

/** Buat sesi baru untuk akun orang tua. */
export async function createSession(db: Db, parentId: string): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  const rows = await db.query<{ id: string; expires_at: Date }>(
    `INSERT INTO parent_session (parent_account_id, token_hash, expires_at)
     VALUES ($1::uuid, $2, $3)
     RETURNING id, expires_at`,
    [parentId, hashToken(token), expiresAt.toISOString()],
  );
  return { token, sessionId: rows.rows[0].id, expiresAt: rows.rows[0].expires_at };
}

/**
 * Sahabatkan token dengan sesi aktif. Mengembalikan `null` bila token tidak
 * dikenal, sesi sudah dicabut, atau sudah kedaluwarsa (VRD 3.4).
 */
export async function resolveSession(
  db: Db,
  token: string | null | undefined,
): Promise<ResolvedSession | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const rows = await db.query<{
    id: string;
    parent_account_id: string;
    expires_at: Date;
  }>(
    `SELECT id, parent_account_id, expires_at
       FROM parent_session
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows.rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    parentId: row.parent_account_id,
    expiresAt: row.expires_at,
  };
}

/** Cabut satu sesi (logout). Idempoten: token tak dikenal tetap dianggap sukses. */
export async function revokeSession(db: Db, token: string | null | undefined): Promise<void> {
  if (!token) return;
  await db.query(
    `UPDATE parent_session SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  );
}

/** Cabut seluruh sesi seorang orang tua (mis. saat ubah kata sandi nanti). */
export async function revokeAllSessions(db: Db, parentId: string): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `UPDATE parent_session SET revoked_at = now()
      WHERE parent_account_id = $1::uuid AND revoked_at IS NULL
      RETURNING id`,
    [parentId],
  );
  return rows.rows.length;
}

/** Bersihkan sesi kedaluwarsa (pemanggilan berkala; aman dijalankan ulang). */
export async function purgeExpiredSessions(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `DELETE FROM parent_session WHERE expires_at <= now() RETURNING id`,
  );
  return rows.rows.length;
}

/**
 * Fungsi bantu untuk menguji cookie: cocokkan nilai cookie dengan token.
 * (Bukan bagian dari jalur otorisasi — DB selalu jadi sumber kebenaran.)
 */
export function tokenMatches(raw: string, expected: string): boolean {
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
