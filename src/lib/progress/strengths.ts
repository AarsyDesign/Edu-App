/**
 * Pemilihan "kekuatan" anak untuk ringkasan orang tua (VRD 10.4).
 *
 * Aturan main:
 * - **Murni dan deterministik** (VRD 9.5): input yang sama → output yang sama,
 *   termasuk tiebreak eksplisit supaya tidak bergantung pada urutan masukan.
 * - **Tanpa ambang** (VRD 9.6/9.7): tidak ada batas "minimal N percobaan" atau
 *   "akurasi ≥ X%" yang dikarang — bila ambang dibutuhkan nanti harus ada bukti
 *   lebih dulu (lihat OQ 23). Yang dilakukan di sini hanya menyeleksi skill
 *   yang punya data (`attempts > 0`) dan mengurutkan fakta yang ada.
 * - **Label manusiawi** (anti-slop, Evidence Over Claims): `learning_progress`
 *   menyimpan `skill_id` berupa UUID — menampilkannya ke orang tua berarti
 *   menampilkan baris database. Makanya ada `buildSkillLabels` yang menerjemahkan
 *   UUID → judul skill + judul area dari `listAllSkillsWithArea`.
 */
import type { SkillAccuracy } from "./engine.ts";
import type { SkillWithArea } from "../learning/areas-skills.ts";

/** Jumlah kekuatan yang ditampilkan pada ringkasan. */
export const STRENGTHS_LIMIT_DEFAULT = 3;
/** Batas atas — mencegah pemanggil meminta daftar sepanjang riwayat. */
export const STRENGTHS_LIMIT_MAX = 5;

/** Teks pengganti bila skill tidak ditemukan (mis. area dinonaktifkan). */
export const SKILL_LABEL_UNKNOWN = "Nama skill tidak tersedia";

/** Pasangan judul skill + judul area untuk ditampilkan orang tua. */
export interface SkillLabel {
  skillTitle: string;
  /** `null` bila area tidak diketahui — pemanggil menyembunyikan bagiannya. */
  areaTitle: string | null;
}

function normalizeLimit(limit: number): number {
  return Number.isInteger(limit) && limit >= 1 && limit <= STRENGTHS_LIMIT_MAX
    ? limit
    : STRENGTHS_LIMIT_DEFAULT;
}

/** Urutan kekuatan: akurasi tertinggi → percobaan terbanyak (lebih stabil) → skillId. */
function byStrength(a: SkillAccuracy, b: SkillAccuracy): number {
  const accA = a.accuracy ?? -1;
  const accB = b.accuracy ?? -1;
  if (accB !== accA) return accB - accA;
  if (b.attempts !== a.attempts) return b.attempts - a.attempts;
  return a.skillId.localeCompare(b.skillId, "en");
}

/**
 * Ambil `limit` skill dengan akurasi tertinggi dari yang pernah dipraktikkan.
 *
 * Skill tanpa percobaan (`attempts <= 0` atau `accuracy: null`) tidak pernah
 * ikut — angka nol bukan kekuatan. Selalu mengembalikan array baru (tidak
 * mengurutkan masukan di tempat).
 */
export function pickStrengths(
  skills: readonly SkillAccuracy[],
  limit: number = STRENGTHS_LIMIT_DEFAULT,
): SkillAccuracy[] {
  const max = normalizeLimit(limit);
  return skills
    .filter((s) => s.attempts > 0 && s.accuracy !== null)
    .slice()
    .sort(byStrength)
    .slice(0, max);
}

/**
 * Peta UUID skill → judul skill + judul area.
 *
 * Sumber: `listAllSkillsWithArea` (hanya area aktif). Skill pada area yang
 * dinonaktifkan sengaja tidak ada di peta → jatuh ke `SKILL_LABEL_UNKNOWN`,
 * bukan ke UUID.
 */
export function buildSkillLabels(skills: readonly SkillWithArea[]): Map<string, SkillLabel> {
  const map = new Map<string, SkillLabel>();
  for (const s of skills) {
    map.set(s.skillId, {
      skillTitle: s.title,
      areaTitle: s.learningAreaTitle || null,
    });
  }
  return map;
}

/** Ambil label skill; UUID tidak pernah dikembalikan apa adanya. */
export function getSkillLabel(
  labels: ReadonlyMap<string, SkillLabel>,
  skillId: string,
): SkillLabel {
  return labels.get(skillId) ?? { skillTitle: SKILL_LABEL_UNKNOWN, areaTitle: null };
}
