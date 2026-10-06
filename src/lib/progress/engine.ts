/**
 * Progress Engine (VRD Phase 9.1–9.4).
 *
 * Semua fungsi di sini bersifat BACA murni dan deterministik: keluaran sama
 * selama data sama. Tidak ada yang menulis `mastered_at` — VRD 9.6 hanya
 * mengizinkan ambang mastery bila ada bukti, dan bukti itu belum ada
 * (lihat OPEN QUESTION di docs/IMPLEMENTATION-AUDIT.md).
 *
 * Otorisasi: modul ini menerima `childId` apa adanya. Setiap pemanggil wajib
 * sudah memvalidasi sesi + kepemilikan lewat `getChildForParent()` (VRD 3.7)
 * sebelum memanggil; pada run ini belum ada endpoint yang mengekspos fungsi
 * ini (ringkasan orang tua menyusul di Phase 10, VRD 9.8).
 *
 * Angka yang dihasilkan adalah FAKTA (jumlah percobaan, jumlah benar) — tanpa
 * label lulus/gagal/peringkat (PRD §9, §10) dan tanpa persentase yang dipaksa
 * keluar dari data kosong: akurasi `null` bila belum ada percobaan (VRD 9.7,
 * jangan overfit sampel nol/kecil).
 */
import type { Db } from "../db/index.ts";

/** Jendela bawaan "performa terkini" (VRD 9.4). */
export const RECENT_WINDOW_DEFAULT = 10;
/** Batas atas jendela — mencegah kueri membaca seluruh riwayat. */
export const RECENT_WINDOW_MAX = 50;

/** Akurasi sederhana per skill (VRD 9.3). */
export interface SkillAccuracy {
  skillId: string;
  /** Jumlah percobaan tersimpan (`learning_progress.attempts_count`). */
  attempts: number;
  /** Jumlah jawaban benar (`learning_progress.correct_count`). */
  correct: number;
  /** `correct / attempts`, atau `null` bila belum ada percobaan. */
  accuracy: number | null;
  lastPracticedAt: Date | null;
  masteredAt: Date | null;
}

/** Satu baris pada jendela performa terkini. */
export interface RecentAttempt {
  attemptId: string;
  activityId: string;
  skillId: string;
  attemptNo: number;
  isCorrect: boolean;
  durationMs: number | null;
  createdAt: Date;
}

/** Performa terkini anak (VRD 9.4) — untuk orang tua, bukan untuk anak. */
export interface RecentPerformance {
  /** Jendela yang diminta (sudah dibatasi 1..RECENT_WINDOW_MAX). */
  window: number;
  /** Percobaan terdinilai, terbaru dulu; panjang ≤ `window`. */
  attempts: RecentAttempt[];
  /** `attempts.length`. */
  total: number;
  /** `correct / total`, atau `null` bila `total` 0. */
  accuracy: number | null;
  /** Sebaran jawaban salah per skill (PRD §21: error distribution). */
  errorsBySkill: Record<string, number>;
}

function accuracyOf(correct: number, attempts: number): number | null {
  if (attempts <= 0) return null;
  return correct / attempts;
}

/**
 * Akurasi sederhana per skill (VRD 9.3).
 *
 * - Sumber: `learning_progress` (diperbarui tiap penilaian di server, VRD 6.9).
 * - `skillIds` opsional: skill yang diminta tapi belum punya baris progres
 *   ikut dikembalikan dengan angka 0 dan `accuracy: null` — supaya pemanggil
 *   tidak salah mengartikan "tidak ada baris" sebagai "100%".
 * - Hasil selalu urut `skillId` ASC supaya deterministik dan bisa dibandingkan
 *   antar-panggilan (VRD 9.5: logika harus deterministik dan teruji).
 * - Tidak ada ambang/label: angka murni fakta (VRD 9.6, 9.7).
 */
export async function getSkillAccuracy(
  db: Db,
  childId: string,
  skillIds?: string[],
): Promise<SkillAccuracy[]> {
  const filterIds = skillIds && skillIds.length > 0 ? [...new Set(skillIds)] : null;

  const rows = await db.query<{
    skill_id: string;
    attempts_count: number;
    correct_count: number;
    last_practiced_at: Date | null;
    mastered_at: Date | null;
  }>(
    `SELECT skill_id, attempts_count, correct_count, last_practiced_at, mastered_at
       FROM learning_progress
      WHERE child_id = $1::uuid
        ${filterIds ? `AND skill_id IN (${filterIds.map((_, i) => `$${i + 2}`).join(", ")})` : ""}
      ORDER BY skill_id ASC`,
    filterIds ? [childId, ...filterIds] : [childId],
  );

  const bySkill = new Map<string, SkillAccuracy>();
  for (const r of rows.rows) {
    bySkill.set(r.skill_id, {
      skillId: r.skill_id,
      attempts: r.attempts_count,
      correct: r.correct_count,
      accuracy: accuracyOf(r.correct_count, r.attempts_count),
      lastPracticedAt: r.last_practiced_at,
      masteredAt: r.mastered_at,
    });
  }

  // Skill yang diminta tetap muncul walaupun belum pernah dipraktikkan.
  for (const id of filterIds ?? []) {
    if (!bySkill.has(id)) {
      bySkill.set(id, {
        skillId: id,
        attempts: 0,
        correct: 0,
        accuracy: null,
        lastPracticedAt: null,
        masteredAt: null,
      });
    }
  }

  return [...bySkill.values()].sort((a, b) => a.skillId.localeCompare(b.skillId, "en"));
}

/**
 * Performa terkini (VRD 9.4): N percobaan terakhir yang sudah dinilai,
 * terbaru dulu.
 *
 * - Percobaan belum dinilai (`is_correct IS NULL`) tidak ikut — angka parsial
 *   akan menyesatkan.
 * - Percobaan asesmen dasar (Phase 8) ikut terhitung: itu jawaban anak yang
 *   sah dan tersimpan di tabel yang sama.
 * - `window` dibatasi 1..RECENT_WINDOW_MAX; nilai di luar rentang jatuh ke
 *   bawaan RECENT_WINDOW_DEFAULT, sehingga `window: 0` tidak pernah berarti
 *   "tanpa data" (data kosong ditandai `accuracy: null`, bukan jendela nol).
 * - Urutan `created_at DESC, id DESC` → deterministik walau dua baris punya
 *   waktu yang sama persis (VRD 9.5).
 */
export async function getRecentPerformance(
  db: Db,
  childId: string,
  options: { window?: number } = {},
): Promise<RecentPerformance> {
  const requested = options.window;
  const window =
    typeof requested === "number" &&
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= RECENT_WINDOW_MAX
      ? requested
      : RECENT_WINDOW_DEFAULT;

  const rows = await db.query<{
    id: string;
    activity_id: string;
    skill_id: string;
    attempt_no: number;
    is_correct: boolean;
    duration_ms: number | null;
    created_at: Date;
  }>(
    `SELECT aa.id, aa.activity_id, a.skill_id, aa.attempt_no, aa.is_correct,
            aa.duration_ms, aa.created_at
       FROM activity_attempt aa
       JOIN activity a ON a.id = aa.activity_id
      WHERE aa.child_id = $1::uuid
        AND aa.is_correct IS NOT NULL
      ORDER BY aa.created_at DESC, aa.id DESC
      LIMIT $2`,
    [childId, window],
  );

  const attempts: RecentAttempt[] = rows.rows.map((r) => ({
    attemptId: r.id,
    activityId: r.activity_id,
    skillId: r.skill_id,
    attemptNo: r.attempt_no,
    isCorrect: r.is_correct,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));

  let correct = 0;
  const errorsBySkill: Record<string, number> = {};
  for (const a of attempts) {
    if (a.isCorrect) correct += 1;
    else errorsBySkill[a.skillId] = (errorsBySkill[a.skillId] ?? 0) + 1;
  }

  return {
    window,
    attempts,
    total: attempts.length,
    accuracy: accuracyOf(correct, attempts.length),
    errorsBySkill,
  };
}
