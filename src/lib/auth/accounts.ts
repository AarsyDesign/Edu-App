/**
 * Registrasi & login orang tua (VRD 3.1, 3.2, 3.10, 3.11).
 *
 * Prinsip:
 * - Login selalu memakai SATU jenis pesan kegagalan ("Email atau kata sandi
 *   salah") untuk email tak terdaftar maupun kata sandi keliru — tidak ada
 *   oracle keberadaan email (VRD 3.11).
 * - Verifikasi berjalan bahkan ketika email tidak ada (hash dummy) supaya
 *   waktunya mirip, bukan hanya pesannya.
 * - Registrasi tetap memberi tahu email sudah dipakai (VRD 3.1 butuh umpan
 *   balik yang bisa ditindaklanjuti); perlindungan terhadap enumerasi lewat
 *   registrasi ditangani rate limiting (VRD 3.9).
 * - Semua kegagalan memakai kode + pesan aman, tanpa detail internal
 *   (VRD 3.10: safe error messages).
 */
import type { Db } from "../db/index.ts";
import { hashPassword, isPasswordLengthValid, verifyPassword } from "./password.ts";

const EMAIL_MAX = 254;
const DISPLAY_NAME_MAX = 80;
// Cukup untuk menolak format yang jelas salah; validasi ketat diserahkan
// ke provider email (konfirmasi via email = pekerjaan fase berikutnya).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type RegisterErrorCode = "INVALID_INPUT" | "EMAIL_TAKEN";
export type LoginErrorCode = "INVALID_INPUT" | "INVALID_CREDENTIALS";

export interface ParentIdentity {
  parentId: string;
  email: string;
  displayName: string;
}

export type Result<T, C extends string> =
  | { ok: true; value: T }
  | { ok: false; code: C; message: string };

export const MESSAGES = {
  invalidInput: "Isian belum lengkap. Periksa kembali formulir.",
  emailTaken: "Email ini sudah terdaftar. Coba masuk.",
  invalidCredentials: "Email atau kata sandi salah.",
} as const;

/** Pesan aman per kode — dipakai endpoint supaya tidak ada detail internal yang bocor. */
export function safeMessage(code: RegisterErrorCode | LoginErrorCode): string {
  switch (code) {
    case "INVALID_INPUT":
      return MESSAGES.invalidInput;
    case "EMAIL_TAKEN":
      return MESSAGES.emailTaken;
    case "INVALID_CREDENTIALS":
      return MESSAGES.invalidCredentials;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

/**
 * Hash verifikasi untuk email yang tidak ada: login yang gagal tetap
 * melakukan pekerjaan scrypt yang sama sehingga waktunya tidak membocorkan
 * apakah email terdaftar.
 */
let decoyHash: string | null = null;
async function getDecoyHash(): Promise<string> {
  decoyHash ??= await hashPassword("decoy-tidak-dipakai-0000");
  return decoyHash;
}

function validate(input: RegisterInput): boolean {
  const email = input.email?.trim() ?? "";
  const name = input.displayName?.trim() ?? "";
  return (
    email.length > 0 &&
    email.length <= EMAIL_MAX &&
    EMAIL_RE.test(email) &&
    name.length >= 1 &&
    name.length <= DISPLAY_NAME_MAX &&
    typeof input.password === "string" &&
    isPasswordLengthValid(input.password)
  );
}

/** VRD 3.1 — daftar akun orang tua baru. */
export async function registerParent(
  db: Db,
  input: RegisterInput,
): Promise<Result<ParentIdentity, RegisterErrorCode>> {
  if (!validate(input)) {
    return { ok: false, code: "INVALID_INPUT", message: safeMessage("INVALID_INPUT") };
  }

  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  const passwordHash = await hashPassword(input.password);

  try {
    const rows = await db.query<{ id: string }>(
      `INSERT INTO parent_account (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, displayName, passwordHash],
    );
    return {
      ok: true,
      value: { parentId: rows.rows[0].id, email, displayName },
    };
  } catch (err) {
    // Unique index lower(btrim(email)) -> duplikat (termasuk beda kapital/spasi).
    if (/duplicate key|unique constraint/i.test(String(err))) {
      return { ok: false, code: "EMAIL_TAKEN", message: safeMessage("EMAIL_TAKEN") };
    }
    throw err;
  }
}

/** Ambil identitas akun berdasarkan id (dipakai saat menampilkan sesi aktif). */
export async function getParentById(db: Db, parentId: string): Promise<ParentIdentity | null> {
  const rows = await db.query<{ id: string; email: string; display_name: string }>(
    `SELECT id, email, display_name FROM parent_account WHERE id = $1::uuid`,
    [parentId],
  );
  const row = rows.rows[0];
  if (!row) return null;
  return { parentId: row.id, email: row.email, displayName: row.display_name };
}

/** VRD 3.2 — masuk ke akun orang tua. Kegagalan selalu `INVALID_CREDENTIALS`. */
export async function loginParent(
  db: Db,
  input: { email: string; password: string },
): Promise<Result<ParentIdentity, LoginErrorCode>> {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  if (email.length === 0 || email.length > EMAIL_MAX || password.length === 0) {
    return { ok: false, code: "INVALID_INPUT", message: safeMessage("INVALID_INPUT") };
  }

  const rows = await db.query<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string | null;
  }>(
    `SELECT id, email, display_name, password_hash
       FROM parent_account
      WHERE lower(btrim(email)) = $1`,
    [normalizeEmail(email)],
  );
  const row = rows.rows[0];

  // Selalu jalankan scrypt: email tak ada = verifikasi terhadap hash dummy.
  const stored = row?.password_hash ?? (await getDecoyHash());
  const valid = await verifyPassword(password, stored);
  if (!row || !valid || !row.password_hash) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: safeMessage("INVALID_CREDENTIALS"),
    };
  }

  return {
    ok: true,
    value: {
      parentId: row.id,
      email: row.email,
      displayName: row.display_name,
    },
  };
}
