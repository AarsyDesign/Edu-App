/**
 * Hash kata sandi orang tua (VRD 3.1–3.2, PRD §14 secure authentication).
 *
 * Algoritma: scrypt (bawaan Node, tanpa dependensi native tambahan) dengan
 * salt acak 16 byte. Hasilnya berformat modular sehingga algoritma + parameter
 * ikut tersimpan — memudahkan peningkatan parameter di masa depan tanpa
 * kolom tambahan.
 *
 * Format: `scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>`
 * Kata sandi tidak pernah disimpan plaintext dan tidak pernah dikirim balik
 * ke klien (SECURITY-PRIVACY: secrets never in client bundle).
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const ALGO = "scrypt";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
// scrypt default maxmem (32 MB) terlalu kecil untuk N=16384+r=8 pada
// sebagian platform; beri ruang cukup tanpa membuka celah alokasi memori.
const MAX_MEM = 64 * 1024 * 1024;

/** Kebijakan kata sandi (PRD/VRD tidak menentukan panjang — keputusan lokal). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export function isPasswordLengthValid(plain: string): boolean {
  return plain.length >= PASSWORD_MIN_LENGTH && plain.length <= PASSWORD_MAX_LENGTH;
}

function scryptAsync(secret: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      Buffer.from(secret, "utf8"),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: MAX_MEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** Hash kata sandi baru. Melempar bila panjang di luar kebijakan. */
export async function hashPassword(plain: string): Promise<string> {
  if (!isPasswordLengthValid(plain)) {
    throw new Error(
      `Kata sandi harus ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} karakter.`,
    );
  }
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(plain, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    ALGO,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Verifikasi kata sandi terhadap hash tersimpan.
 * Selalu mengembalikan `false` (bukan melempar) untuk input rusak/tak dikenal,
 * supaya lapisan pemanggil bisa memperlakukan semua kegagalan sama.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!isPasswordLengthValid(plain)) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== ALGO) return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 1024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(plain, salt, n, r, p);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
