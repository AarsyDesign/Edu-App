/**
 * Profil anak (VRD Phase 4, item 4.1–4.7, 4.9–4.10) — lapisan data + validasi.
 *
 * Kebutuhan: PRD §8 (onboarding: nickname, usia 3–7, avatar non-hidup, bahasa,
 * learning goals), §14 (privasi: tanpa PII berlebih, data anak tercakup akun
 * orang tua), SECURITY-PRIVACY (minimisasi field, constraint database).
 *
 * Kaidah yang dijaga di sini:
 * - `parent_account_id` SELALU datang dari sesi yang sudah divalidasi
 *   middleware — tidak pernah dari body/kueri klien (VRD 3.8).
 * - Kolom child_profile sudah dibatasi migrasi 0001: tidak ada nama lengkap,
 *   tanggal lahir, alamat, telepon, lokasi, foto. Modul ini tidak pernah
 *   menulis kolom di luar daftar itu.
 * - Nickname aktif unik per akun (index parsial di database); bentrok yang
 *   terdeteksi di sini sebagai `NICKNAME_TAKEN`, bukan error 500.
 * - Kegagalan selalu memakai kode + pesan aman, tanpa detail internal
 *   (VRD 3.10).
 *
 * Keputusan yang BELUM ada di PRD/VRD (dicatat sebagai OPEN QUESTION):
 * - kosakata "learning goals" (PRD §8 hanya menyebut field-nya) → sementara
 *   teks bebas pendek, maksimal 6 butir;
 * - daftar bahasa yang tersedia → sementara mengikuti kolom `language`
 *   (default 'id');
 * - restorasi profil terarsip & retensi hapus permanen (PRD §14) → kini
 *   arsip bersifat satu arah, tanpa penghapusan permanen.
 */
import type { Result } from "../auth/accounts.ts";
import { getChildForParent, type ChildRecord } from "../auth/guard.ts";
import { isAvatarKey } from "./avatars.ts";
import type { Db } from "../db/index.ts";

export const CHILD_LIMITS = {
  nicknameMax: 40,
  ageMin: 3,
  ageMax: 7,
  avatarKeyMax: 40,
  /** PRD §8: "Learning goals" — jumlah butir dibatasi supaya onboarding tetap singkat. */
  goalsMax: 6,
  goalMax: 40,
} as const;

/**
 * Motif avatar non-hidup: kunci teknis + keanggotaan katalog (OQ 15 ditutup
 * 2026-10-10). Katalog `AVATAR_CATALOG` mengikuti daftar ilustrasi DESIGN.md
 * dan dipakai bersama oleh form profil, kartu profil, dan validasi server ini.
 */
const AVATAR_KEY_RE = /^[a-z0-9_-]+$/;
/** Mirip constraint kolom `language` di migrasi 0001. */
const LANGUAGE_RE = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/;

export type ChildErrorCode = "INVALID_INPUT" | "NICKNAME_TAKEN" | "NOT_FOUND";

export const CHILD_MESSAGES = {
  invalidInput: "Isian profil anak belum lengkap atau tidak valid.",
  nicknameTaken: "Nickname ini sudah dipakai oleh profil aktif lain.",
  notFound: "Profil anak tidak ditemukan.",
} as const;

/** Pesan aman per kode — dipakai endpoint supaya tidak ada detail internal yang bocor. */
export function childSafeMessage(code: ChildErrorCode): string {
  switch (code) {
    case "INVALID_INPUT":
      return CHILD_MESSAGES.invalidInput;
    case "NICKNAME_TAKEN":
      return CHILD_MESSAGES.nicknameTaken;
    case "NOT_FOUND":
      return CHILD_MESSAGES.notFound;
  }
}

function failure<C extends ChildErrorCode>(code: C): Result<never, C> {
  return { ok: false, code, message: childSafeMessage(code) };
}

const BAD = Symbol("field-invalid");

/** Isian yang berhasil dibaca dari body (hanya kunci yang dikirim klien). */
export interface ChildFields {
  nickname?: string;
  age?: number;
  avatarKey?: string | null;
  language?: string;
  learningGoals?: string[];
}

const KNOWN_KEYS = new Set(["nickname", "age", "avatarKey", "language", "learningGoals"]);

function parseNickname(value: unknown): string | typeof BAD {
  if (typeof value !== "string") return BAD;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > CHILD_LIMITS.nicknameMax) return BAD;
  return trimmed;
}

function parseAge(value: unknown): number | typeof BAD {
  // Bilangan bulat saja: "5" maupun 5.5 ditolak, sesuai CHECK 3–7 di skema.
  if (typeof value !== "number" || !Number.isInteger(value)) return BAD;
  if (value < CHILD_LIMITS.ageMin || value > CHILD_LIMITS.ageMax) return BAD;
  return value;
}

function parseAvatarKey(value: unknown): string | null | typeof BAD {
  if (value === null) return null;
  if (typeof value !== "string") return BAD;
  if (value.length < 1 || value.length > CHILD_LIMITS.avatarKeyMax) return BAD;
  if (!AVATAR_KEY_RE.test(value)) return BAD;
  // Kunci teknis yang valid pun harus ada di katalog — API tidak bisa dipakai
  // menyimpan motif yang tidak pernah ditawarkan UI (mis. nama hewan/fiksi).
  if (!isAvatarKey(value)) return BAD;
  return value;
}

function parseLanguage(value: unknown): string | typeof BAD {
  if (typeof value !== "string") return BAD;
  if (!LANGUAGE_RE.test(value)) return BAD;
  return value;
}

function parseLearningGoals(value: unknown): string[] | typeof BAD {
  if (!Array.isArray(value)) return BAD;
  if (value.length > CHILD_LIMITS.goalsMax) return BAD;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return BAD;
    const trimmed = item.trim();
    if (trimmed.length < 1 || trimmed.length > CHILD_LIMITS.goalMax) return BAD;
    out.push(trimmed);
  }
  return out;
}

type Parsed = { ok: true; value: ChildFields } | { ok: false };

/**
 * Baca body profil anak. Hanya kunci yang dikenal; kunci asing, nilai salah
 * jenis, dan angka di luar rentang semuanya menghasilkan `INVALID_INPUT`
 * supaya salah ketik tidak diam-diam diabaikan.
 */
export function parseChildInput(
  body: Record<string, unknown>,
  options: { mode: "create" | "patch" },
): Parsed {
  for (const key of Object.keys(body)) {
    if (!KNOWN_KEYS.has(key)) return { ok: false };
  }

  const value: ChildFields = {};

  if ("nickname" in body) {
    const parsed = parseNickname(body.nickname);
    if (parsed === BAD) return { ok: false };
    value.nickname = parsed;
  }
  if ("age" in body) {
    const parsed = parseAge(body.age);
    if (parsed === BAD) return { ok: false };
    value.age = parsed;
  }
  if ("avatarKey" in body) {
    const parsed = parseAvatarKey(body.avatarKey);
    if (parsed === BAD) return { ok: false };
    value.avatarKey = parsed;
  }
  if ("language" in body) {
    const parsed = parseLanguage(body.language);
    if (parsed === BAD) return { ok: false };
    value.language = parsed;
  }
  if ("learningGoals" in body) {
    const parsed = parseLearningGoals(body.learningGoals);
    if (parsed === BAD) return { ok: false };
    value.learningGoals = parsed;
  }

  if (options.mode === "create") {
    // 4.1 butuh nickname + usia (4.2, 4.3); sisanya opsional sesuai PRD §8.
    if (value.nickname === undefined || value.age === undefined) return { ok: false };
  } else if (Object.keys(value).length === 0) {
    return { ok: false };
  }

  return { ok: true, value };
}

/** Kolom yang dibaca/ditulis modul ini — penjaga agar tidak ada PII tambahan. */
const CHILD_COLUMNS = `id, parent_account_id, nickname, age, avatar_key,
       language, learning_goals, archived_at, created_at`;

function toRecord(row: {
  id: string;
  parent_account_id: string;
  nickname: string;
  age: number;
  avatar_key: string | null;
  language: string;
  learning_goals: string[] | null;
  archived_at: Date | null;
  created_at: Date;
}): ChildRecord & { createdAt: Date } {
  return {
    childId: row.id,
    parentAccountId: row.parent_account_id,
    nickname: row.nickname,
    age: Number(row.age),
    avatarKey: row.avatar_key,
    language: row.language,
    learningGoals: row.learning_goals ?? [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export type ChildProfile = ChildRecord & { createdAt: Date };

/** VRD 4.1–4.7 — buat profil anak milik sesi berjalan. */
export async function createChildProfile(
  db: Db,
  parentId: string,
  body: Record<string, unknown>,
): Promise<Result<ChildProfile, ChildErrorCode>> {
  const parsed = parseChildInput(body, { mode: "create" });
  if (!parsed.ok) return failure("INVALID_INPUT");

  const fields = parsed.value;
  try {
    const rows = await db.query<{
      id: string;
      parent_account_id: string;
      nickname: string;
      age: number;
      avatar_key: string | null;
      language: string;
      learning_goals: string[] | null;
      archived_at: Date | null;
      created_at: Date;
    }>(
      `INSERT INTO child_profile
         (parent_account_id, nickname, age, avatar_key, language, learning_goals)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::text[])
       RETURNING ${CHILD_COLUMNS}`,
      [
        parentId,
        fields.nickname,
        fields.age,
        fields.avatarKey ?? null,
        fields.language ?? "id",
        fields.learningGoals ?? [],
      ],
    );
    return { ok: true, value: toRecord(rows.rows[0]) };
  } catch (err) {
    // Index unik nickname aktif per akun (migrasi 0001) — termasuk beda kapital/spasi.
    if (/duplicate key|unique constraint/i.test(String(err))) {
      return failure("NICKNAME_TAKEN");
    }
    throw err;
  }
}

/** Semua profil AKTIF milik satu akun (dasar child switcher, VRD 4.8). */
export async function listChildrenForParent(
  db: Db,
  parentId: string,
): Promise<ChildProfile[]> {
  const rows = await db.query<{
    id: string;
    parent_account_id: string;
    nickname: string;
    age: number;
    avatar_key: string | null;
    language: string;
    learning_goals: string[] | null;
    archived_at: Date | null;
    created_at: Date;
  }>(
    `SELECT ${CHILD_COLUMNS}
       FROM child_profile
      WHERE parent_account_id = $1::uuid
        AND archived_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    [parentId],
  );
  return rows.rows.map(toRecord);
}

/** VRD 4.9 — ubah profil anak yang dimiliki dan belum diarsipkan. */
export async function updateChildProfile(
  db: Db,
  childId: string,
  parentId: string,
  body: Record<string, unknown>,
): Promise<Result<ChildProfile, ChildErrorCode>> {
  const parsed = parseChildInput(body, { mode: "patch" });
  if (!parsed.ok) return failure("INVALID_INPUT");

  // Kepemilikan selalu lewat gerbang 3.7 (klausa parent_account_id di server).
  const existing = await getChildForParent(db, childId, parentId);
  if (!existing || existing.archivedAt !== null) return failure("NOT_FOUND");

  const next = {
    nickname: parsed.value.nickname ?? existing.nickname,
    age: parsed.value.age ?? existing.age,
    avatarKey: "avatarKey" in parsed.value ? parsed.value.avatarKey : existing.avatarKey,
    language: parsed.value.language ?? existing.language,
    learningGoals: parsed.value.learningGoals ?? existing.learningGoals,
  };

  try {
    const rows = await db.query<{
      id: string;
      parent_account_id: string;
      nickname: string;
      age: number;
      avatar_key: string | null;
      language: string;
      learning_goals: string[] | null;
      archived_at: Date | null;
      created_at: Date;
    }>(
      `UPDATE child_profile
          SET nickname = $3,
              age = $4,
              avatar_key = $5,
              language = $6,
              learning_goals = $7::text[]
        WHERE id = $1::uuid
          AND parent_account_id = $2::uuid
          AND archived_at IS NULL
        RETURNING ${CHILD_COLUMNS}`,
      [
        childId,
        parentId,
        next.nickname,
        next.age,
        next.avatarKey,
        next.language,
        next.learningGoals,
      ],
    );
    const row = rows.rows[0];
    if (!row) return failure("NOT_FOUND");
    return { ok: true, value: toRecord(row) };
  } catch (err) {
    if (/duplicate key|unique constraint/i.test(String(err))) {
      return failure("NICKNAME_TAKEN");
    }
    throw err;
  }
}

/**
 * VRD 4.10 — arsipkan profil anak (retensi: riwayat belajar TIDAK dihapus).
 *
 * PRD §14 meminta "configurable retention/deletion strategy" tetapi tidak
 * memberi kebijakannya, jadi penghapusan permanen tidak ditawarkan; arsip
 * menyembunyikan profil dari daftar aktif tanpa membuang data. Idempoten:
 * mengarsipkan profil yang sudah terarsip dianggap berhasil.
 */
export async function archiveChildProfile(
  db: Db,
  childId: string,
  parentId: string,
): Promise<Result<ChildProfile, ChildErrorCode>> {
  const rows = await db.query<{
    id: string;
    parent_account_id: string;
    nickname: string;
    age: number;
    avatar_key: string | null;
    language: string;
    learning_goals: string[] | null;
    archived_at: Date | null;
    created_at: Date;
  }>(
    `UPDATE child_profile
        SET archived_at = now()
      WHERE id = $1::uuid
        AND parent_account_id = $2::uuid
        AND archived_at IS NULL
      RETURNING ${CHILD_COLUMNS}`,
    [childId, parentId],
  );
  const row = rows.rows[0];
  if (row) return { ok: true, value: toRecord(row) };

  // Tidak ada baris aktif: sudah terarsip (idempoten) atau bukan milik kita
  // / tidak ada. Keduanya dibedakan dengan satu SELECT bergaris kepemilikan.
  const current = await db.query<{
    id: string;
    parent_account_id: string;
    nickname: string;
    age: number;
    avatar_key: string | null;
    language: string;
    learning_goals: string[] | null;
    archived_at: Date | null;
    created_at: Date;
  }>(
    `SELECT ${CHILD_COLUMNS}
       FROM child_profile
      WHERE id = $1::uuid
        AND parent_account_id = $2::uuid
        AND archived_at IS NOT NULL`,
    [childId, parentId],
  );
  const currentRow = current.rows[0];
  return currentRow ? { ok: true, value: toRecord(currentRow) } : failure("NOT_FOUND");
}
