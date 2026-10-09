/**
 * Umpan balik layar anak (VRD 6.12 — explanation/feedback).
 *
 * Konten aktivitas memuat field `explanation` ("Umpan balik untuk anak",
 * lihat docs/AI-DRAFT-SCHEMA.md + daftar field PRD §7) yang ditulis reviewer
 * lewat editor. QA E2E eksploratif 2026-10-09 menemukan field itu tidak
 * pernah sampai ke anak: endpoint hanya mengembalikan teks generik hasil
 * `validateAnswer`, sehingga anak tidak pernah membaca penjelasan konten.
 *
 * Aturan di sini, sederhana dan deterministik:
 * 1. penjelasan konten (bila ada, setelah trim) dipakai lebih dulu;
 * 2. kalau kosong → teks generik dari mesin penilaian;
 * 3. kalau keduanya kosong → jatuh ke rumus benar/salah yang lama.
 *
 * Murni tanpa I/O supaya bisa diuji langsung.
 */
export function feedbackExplanation(
  contentExplanation: string | null | undefined,
  verdictExplanation: string | null | undefined,
  isCorrect: boolean,
): string {
  const content =
    typeof contentExplanation === "string" ? contentExplanation.trim() : "";
  if (content !== "") return content;

  const verdict =
    typeof verdictExplanation === "string" ? verdictExplanation.trim() : "";
  if (verdict !== "") return verdict;

  return isCorrect ? "Tepat sekali!" : "Belum tepat, coba lagi.";
}
