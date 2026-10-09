/**
 * Gerbang umpan balik layar anak + kosakata label tipe (VRD 6.12).
 *
 * Temuan QA E2E eksploratif 2026-10-09: field `explanation` aktivitas
 * ("Umpan balik untuk anak", docs/AI-DRAFT-SCHEMA.md) tidak pernah sampai ke
 * anak — endpoint hanya mengembalikan teks generik `validateAnswer`, dan
 * renderer menerima `input.explanation` tetapi tidak pernah memakainya.
 * Tes ini mengunci perbaikannya: kedua endpoint wajib lewat
 * `feedbackExplanation`, dan teks generik lama tetap jatuh bila konten kosong.
 *
 * Temuan kedua (copy): label TAP_ANSWER "Tukar Jawaban" salah terjemah dari
 * "Tap Answer" dan tampil di layar anak — kini "Pilih Jawaban".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { feedbackExplanation } from "../src/lib/activity/feedback.ts";
import { getActivityTypeLabel } from "../src/lib/activity/labels.ts";

const read = (rel: string): Promise<string> => readFile(new URL(rel, import.meta.url), "utf8");

test("6.12 penjelasan konten lebih dulu, lalu teks mesin, lalu jatuh", () => {
  // Konten dipakai lebih dulu (benar & salah) — inilah yang dibaca anak.
  assert.equal(feedbackExplanation("Apel berwarna merah.", "Tepat sekali!", true), "Apel berwarna merah.");
  assert.equal(feedbackExplanation("Langit memang berada di atas kita.", "Benar!", true), "Langit memang berada di atas kita.");
  assert.equal(feedbackExplanation("  Penjelasan konten.  ", "Belum tepat, coba lagi.", false), "Penjelasan konten.");
  // Konten kosong → teks mesin penilaian (perilaku lama tidak hilang).
  assert.equal(feedbackExplanation(null, "Tepat sekali!", true), "Tepat sekali!");
  assert.equal(feedbackExplanation("", "Belum tepat, coba lagi.", false), "Belum tepat, coba lagi.");
  assert.equal(feedbackExplanation(undefined, "  ", false), "Belum tepat, coba lagi.");
  // Keduanya kosong → jatuh ke rumus benar/salah lama.
  assert.equal(feedbackExplanation(null, null, true), "Tepat sekali!");
  assert.equal(feedbackExplanation(undefined, undefined, false), "Belum tepat, coba lagi.");
  // Tidak pernah keluar string kosong (gerbang respons non-kosong lama).
  assert.notEqual(feedbackExplanation("", "", true), "");
  assert.notEqual(feedbackExplanation("   ", "   ", false), "");
});

test("6.12 kedua endpoint memakai feedbackExplanation (attempt + pratinjau)", async () => {
  const attempt = await read("../src/pages/api/activity/attempt.ts");
  assert.ok(
    attempt.includes("feedbackExplanation(") && attempt.includes("activity.explanation"),
    "endpoint jawaban anak wajib mengembalikan penjelasan konten lebih dulu",
  );
  assert.ok(
    !attempt.includes('verdict.explanation ?? (verdict.isCorrect'),
    "jalur lama (hanya teks generik) harus dibuang",
  );
  const preview = await read("../src/pages/api/reviewer/aktivitas/[id]/preview.ts");
  assert.ok(
    preview.includes("feedbackExplanation(") && preview.includes("detail.activity.explanation"),
    "pratinjau reviewer harus identik dengan umpan balik produksi (acceptance 11.12)",
  );
  // Renderer tetap menerima explanation dari halaman (dokumen kontrak).
  const page = await read("../src/pages/learn/aktivitas/[id].astro");
  assert.ok(page.includes("explanation: activity.explanation"), "halaman aktivitas tetap meneruskan explanation");
});

test("6.12 label TAP_ANSWER tidak lagi memakai terjemahan keliru", async () => {
  assert.equal(getActivityTypeLabel("TAP_ANSWER"), "Pilih Jawaban");
  // Delapan tipe wajib berlabel — anti-drift bila enum bertambah.
  for (const type of [
    "TAP_ANSWER", "COUNT_OBJECTS", "MATCH", "SEQUENCE",
    "IDENTIFY_COLOR", "IDENTIFY_SHAPE", "MULTIPLE_CHOICE", "TRUE_FALSE",
  ]) {
    const label = getActivityTypeLabel(type);
    assert.ok(label && label.length > 0, `${type} tanpa label`);
    assert.notEqual(label, type, `${type} tampil sebagai enum mentah`);
  }
  // Kata lama tidak boleh tersisa di src (layar anak maupun editor reviewer).
  // Komentar dokumen dikecualikan — boleh menyebut nilai lama untuk riwayat.
  const files = [
    "../src/lib/activity/labels.ts",
    "../src/components/ActivityEditorForm.astro",
    "../src/pages/learn.astro",
    "../src/pages/learn/area/[code].astro",
  ];
  for (const rel of files) {
    const raw = await read(rel);
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.ok(!src.includes("Tukar Jawaban"), `${rel} masih memuat "Tukar Jawaban"`);
  }
});
