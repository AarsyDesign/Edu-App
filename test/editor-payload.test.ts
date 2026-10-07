/**
 * Test logika payload editor (VRD 11.2–11.10) — fungsi murni tanpa DOM,
 * dipakai langsung oleh skrip `ActivityEditorForm.astro`.
 *
 * Menguji penyusunan `correct_answer` untuk kedelapan tipe interaksi dan
 * pemeriksaan sebelum kirim (galat ditangkap di browser, server tetap
 * memvalidasi ulang).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { buildActivityPayload, validateActivityPayload } = await import(
  "../src/lib/activity/editor-payload.ts"
);
const { validateActivityData } = await import("../src/lib/activity/domain.ts");

const common = {
  prompt: "Mana yang merah?",
  learningAreaId: "11111111-1111-4111-8111-111111111111",
  skillId: "22222222-2222-4222-8222-222222222222",
  targetAgeMin: 3,
  targetAgeMax: 5,
  difficulty: 1,
  explanation: "Apel merah.",
  contentOrigin: "HUMAN_CREATED",
  sources: [],
};

function build(
  interactionType: Parameters<typeof buildActivityPayload>[0]["common"]["interactionType"],
  rows: Array<Record<string, string | boolean>>,
  trueFalse: boolean | null = null,
): Record<string, unknown> {
  return buildActivityPayload({
    common: { ...common, interactionType },
    rows,
    trueFalse,
  });
}

test("11.7 payload TAP_ANSWER: id urut, nilai kosong dihilangkan, satu benar", () => {
  const payload = build("TAP_ANSWER", [
    { label: "Apel", value: "", correct: true },
    { label: "Pisang", correct: false },
  ]);
  const answer = payload.correct_answer as {
    items: Array<{ id: string; label: string; value?: string; isCorrect: boolean }>;
  };
  assert.equal(answer.items.length, 2);
  assert.equal(answer.items[0].id, "opt-1");
  assert.equal("value" in answer.items[0], false);
  assert.deepEqual(
    answer.items.map((item) => item.isCorrect),
    [true, false],
  );
  assert.equal(validateActivityData("TAP_ANSWER", answer).type, "tap_answer");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload MULTIPLE_CHOICE: pertanyaan memakai prompt, beberapa benar sah", () => {
  const payload = build("MULTIPLE_CHOICE", [
    { label: "A", correct: true },
    { label: "B", correct: true },
    { label: "C", correct: false },
  ]);
  const answer = payload.correct_answer as {
    question: string;
    options: Array<{ isCorrect: boolean }>;
  };
  assert.equal(answer.question, common.prompt);
  assert.equal(answer.options.filter((o) => o.isCorrect).length, 2);
  assert.equal(validateActivityData("MULTIPLE_CHOICE", answer).type, "multiple_choice");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload COUNT_OBJECTS: jumlah total & maxAnswer dihitung otomatis", () => {
  const payload = build("COUNT_OBJECTS", [
    { visualKey: "apel", count: "3" },
    { visualKey: "jeruk", count: "2" },
  ]);
  const answer = payload.correct_answer as {
    objects: Array<{ count: number }>;
    correctAnswer: number;
    maxAnswer: number;
  };
  assert.equal(answer.correctAnswer, 5);
  assert.equal(answer.maxAnswer, 5);
  assert.deepEqual(
    answer.objects.map((o) => o.count),
    [3, 2],
  );
  assert.equal(validateActivityData("COUNT_OBJECTS", answer).type, "count_objects");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload SEQUENCE: posisi benar mengikuti urutan baris", () => {
  const payload = build("SEQUENCE", [
    { label: "Shalat" },
    { label: "Sarapan" },
    { label: "Belajar" },
  ]);
  const answer = payload.correct_answer as {
    items: Array<{ correctPosition: number }>;
  };
  assert.deepEqual(
    answer.items.map((item) => item.correctPosition),
    [0, 1, 2],
  );
  assert.equal(validateActivityData("SEQUENCE", answer).type, "sequence");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload MATCH: pasangan kiri-kanan tersambung per baris", () => {
  const payload = build("MATCH", [
    { left: "Satu", right: "1" },
    { left: "Dua", right: "2" },
  ]);
  const answer = payload.correct_answer as {
    left: Array<{ id: string }>;
    right: Array<{ id: string }>;
    correctPairs: Record<string, string>;
  };
  assert.deepEqual(answer.correctPairs, { "left-1": "right-1", "left-2": "right-2" });
  assert.equal(validateActivityData("MATCH", answer).type, "match");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload IDENTIFY_COLOR: nama target diambil dari opsi benar", () => {
  const payload = build("IDENTIFY_COLOR", [
    { colorName: "Merah", colorValue: "#b85a52", correct: true },
    { colorName: "Biru", colorValue: "#ddeaf5", correct: false },
  ]);
  const answer = payload.correct_answer as {
    targetColorName: string;
    options: Array<{ colorValue: string }>;
  };
  assert.equal(answer.targetColorName, "Merah");
  assert.equal(validateActivityData("IDENTIFY_COLOR", answer).type, "identify_color");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload IDENTIFY_SHAPE: nama target & kunci bawaan", () => {
  const payload = build("IDENTIFY_SHAPE", [
    { shapeName: "Lingkaran", shapeKey: "circle", correct: false },
    { shapeName: "Persegi", shapeKey: "square", correct: true },
  ]);
  const answer = payload.correct_answer as { targetShapeName: string };
  assert.equal(answer.targetShapeName, "Persegi");
  assert.equal(validateActivityData("IDENTIFY_SHAPE", answer).type, "identify_shape");
  assert.equal(validateActivityPayload(payload), null);
});

test("11.7 payload TRUE_FALSE: belum dipilih tidak ditebak jadi benar/salah", () => {
  const unanswered = build("TRUE_FALSE", [], null);
  const answer = unanswered.correct_answer as { correctAnswer: unknown };
  assert.equal(answer.correctAnswer, null);
  assert.equal(
    validateActivityPayload(unanswered),
    "Pilih salah satu: pernyataan benar atau salah.",
  );

  const answered = build("TRUE_FALSE", [], false);
  const chosen = answered.correct_answer as { correctAnswer: boolean };
  assert.equal(chosen.correctAnswer, false);
  assert.equal(validateActivityData("TRUE_FALSE", chosen).type, "true_false");
  assert.equal(validateActivityPayload(answered), null);
});

// ---------- pemeriksaan sebelum kirim ----------

test("11.2 pemeriksaan: prompt kosong, usia terbalik, dan skill hilang ditolak", () => {
  const good = build("TAP_ANSWER", [
    { label: "A", correct: true },
    { label: "B", correct: false },
  ]);

  assert.equal(
    validateActivityPayload({ ...good, prompt: "" }),
    "Pertanyaan wajib diisi.",
  );
  assert.equal(
    validateActivityPayload({ ...good, target_age_min: 6, target_age_max: 4 }),
    "Usia terkecil tidak boleh melebihi usia terbesar.",
  );
  assert.equal(
    validateActivityPayload({ ...good, skill_id: "" }),
    "Area belajar ini belum punya skill.",
  );
});

test("11.7 pemeriksaan: tanpa opsi benar, label kosong, dan label kembar ditolak", () => {
  const noCorrect = build("TAP_ANSWER", [
    { label: "A", correct: false },
    { label: "B", correct: false },
  ]);
  assert.equal(validateActivityPayload(noCorrect), "Tandai tepat satu opsi sebagai benar.");

  const blank = build("TAP_ANSWER", [
    { label: "", correct: true },
    { label: "B", correct: false },
  ]);
  assert.equal(validateActivityPayload(blank), "Setiap baris wajib diisi.");

  const duplicate = build("TAP_ANSWER", [
    { label: "A", correct: true },
    { label: "A", correct: false },
  ]);
  assert.equal(validateActivityPayload(duplicate), "Teks pilihan tidak boleh sama persis.");
});

test("11.7 pemeriksaan: MATCH butuh dua pasangan berisi, COUNT butuh jumlah > 0", () => {
  const singlePair = build("MATCH", [{ left: "Satu", right: "1" }]);
  assert.equal(validateActivityPayload(singlePair), "Butuh minimal dua pasangan.");

  const blankRight = build("MATCH", [
    { left: "Satu", right: "1" },
    { left: "Dua", right: "" },
  ]);
  assert.equal(
    validateActivityPayload(blankRight),
    "Setiap pasangan butuh sisi kiri dan kanan.",
  );

  const zeroCount = build("COUNT_OBJECTS", [
    { visualKey: "apel", count: "0" },
    { visualKey: "jeruk", count: "2" },
  ]);
  assert.equal(
    validateActivityPayload(zeroCount),
    "Jumlah tiap kelompok harus lebih dari nol.",
  );
});
