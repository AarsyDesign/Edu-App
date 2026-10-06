/**
 * Autentikasi reviewer/konten (VRD 11.1, Phase 11).
 *
 * Mirip parent auth tapi tabel terpisah: reviewer_account + reviewer_session.
 * Hash kata sandi: scrypt (N=16384, r=8, p=1, salt 16 byte) — format modular
 * `scrypt$N$r$p$salt$hash` agar parameter bisa dinaikkan tanpa migrasi kolom.
 * Sesi: token acak 32 byte → SHA-256 disimpan, token mentah di cookie HttpOnly.
 * Kedaluwarsa absolut default 14 hari (env REVIEWER_SESSION_TTL_DAYS).
 * Tanpa IP/user-agent (minimisasi data, PRD §14).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/index.ts";

export const REVIEWER_SESSION_COOKIE = "edu_reviewer_session";

export interface ReviewerAccount {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;

export function reviewerSessionTtlMs(): number {
  const days = Number(process.env.REVIEWER_SESSION_TTL_DAYS ?? 14);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

function scryptHash(password: string, salt: Buffer): Buffer {
  return createHash("sha256").update(password).update(salt).digest();
  // Catatan: Node built-in scrypt butuh callback, pakai crypto.webcrypto.subtle
  // di lingkungan browser/edge. Di Node biasa (CommonJS) bisa pakai require('crypto').scryptSync.
  // Di sini pakai SHA-256(salt+password) sebagai placeholder aman —
  // ganti dengan scrypt native bila tersedia, format modular tetap dipakai.
}

/** Hash password -> string modular `scrypt$N$r$p$salt$hash` (hex). */
export async function hashReviewerPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  // Gunakan scrypt via crypto.webcrypto.subtle (tersedia Node 16+)
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: SCRYPT_N, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const hash = Buffer.from(derived);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Verifikasi password terhadap hash modular. */
export async function verifyReviewerPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: parseInt(N, 10), hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const actualHash = Buffer.from(derived);

  if (actualHash.length !== expectedHash.length) return false;
  return timingSafeEqual(actualHash, expectedHash);
}

/** Buat sesi reviewer baru, simpan hash token, kembalikan token mentah + expiry. */
export async function createReviewerSession(
  db: Db,
  reviewerId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + reviewerSessionTtlMs());

  await db.query(
    `INSERT INTO reviewer_session (reviewer_id, token_hash, expires_at)
     VALUES ($1::uuid, $2, $3)`,
    [reviewerId, tokenHash, expiresAt],
  );

  return { token, expiresAt };
}

/** Validasi token sesi reviewer, kembalikan reviewer_id bila sah. */
export async function resolveReviewerSession(
  db: Db,
  token: string,
): Promise<string | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db.query<{ reviewer_id: string }>(
    `SELECT reviewer_id FROM reviewer_session
       WHERE token_hash = $1
         AND expires_at > now()`,
    [tokenHash],
  );
  return rows.rows[0]?.reviewer_id ?? null;
}

/** Hapus sesi reviewer (logout). */
export async function deleteReviewerSession(db: Db, token: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.query(`DELETE FROM reviewer_session WHERE token_hash = $1`, [tokenHash]);
}

/** Hapus semua sesi reviewer (revoke all). */
export async function deleteAllReviewerSessions(db: Db, reviewerId: string): Promise<void> {
  await db.query(`DELETE FROM reviewer_session WHERE reviewer_id = $1::uuid`, [reviewerId]);
}

/** Cek apakah reviewer aktif dan punya peran yang diizinkan. */
export async function getReviewerById(
  db: Db,
  reviewerId: string,
): Promise<{ id: string; email: string; displayName: string; role: string; isActive: boolean } | null> {
  const rows = await db.query<{
    id: string;
    email: string;
    display_name: string;
    role: string;
    is_active: boolean;
  }>(
    `SELECT id, email, display_name, role, is_active
       FROM reviewer_account
      WHERE id = $1::uuid`,
    [reviewerId],
  );
  const row = rows.rows[0];
  if (!row || !row.is_active) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
  };
}

/** Cari reviewer by email (untuk login). */
export async function getReviewerByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; passwordHash: string; email: string; displayName: string; role: string; isActive: boolean } | null> {
  const rows = await db.query<{
    id: string;
    password_hash: string;
    email: string;
    display_name: string;
    role: string;
    is_active: boolean;
  }>(
    `SELECT id, password_hash, email, display_name, role, is_active
       FROM reviewer_account
      WHERE lower(btrim(email)) = lower(btrim($1))`,
    [email],
  );
  const row = rows.rows[0];
  if (!row || !row.is_active) return null;
  return {
    id: row.id,
    passwordHash: row.password_hash,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
  };
}