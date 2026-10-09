/**
 * Label tipe aktivitas untuk layar anak — dipakai child home (`/learn`)
 * dan halaman detail area (`/learn/area/:code`) supaya istilahnya konsisten.
 * Teks diambil dari salinan yang sudah ada di child home; tidak menambah
 * istilah baru.
 */
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  // Koreksi copy 2026-10-09: "Tukar Jawaban" salah terjemah dari "Tap Answer"
  // (tukar = menukar, padahal anak memilih satu jawaban) — kini "Pilih Jawaban",
  // sejajar kata kerja label lain (Hitung Benda, Cocokkan, Urutkan).
  TAP_ANSWER: "Pilih Jawaban",
  COUNT_OBJECTS: "Hitung Benda",
  MATCH: "Cocokkan",
  SEQUENCE: "Urutkan",
  IDENTIFY_COLOR: "Kenali Warna",
  IDENTIFY_SHAPE: "Kenali Bentuk",
  MULTIPLE_CHOICE: "Pilihan Ganda",
  TRUE_FALSE: "Benar/Salah",
};

export function getActivityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? type;
}

/** Label kesukaran netral (Phase 5 no. 2 — label per level menyusul konten). */
export function getDifficultyLabel(difficulty: number): string {
  const level = Number.isFinite(difficulty) ? Math.min(3, Math.max(1, Math.round(difficulty))) : 1;
  return `Tingkat ${level}`;
}
