/**
 * CONTENT-SPEC §7 — Activity Payload Conventions (penutup OQ 21).
 *
 * Spesifikasi eksekusi untuk penanaman konten Phase 13: setiap tipe aktivitas
 * dikodekan ke bentuk baris `activity` + `activity_option` persis seperti
 * dijelaskan di docs/CONTENT-SPEC.md §7.2, lalu dibangun ulang dengan
 * `buildActivityData`. Bila test ini dan §7.2 tidak sepakat, perbaiki dokumen
 * sebelum konten ditanam.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as content from "../src/lib/activity/content.ts";
import {
  activityTestFixtures,
  validateAnswer,
  type ActivityType,
} from "../src/lib/activity/domain.ts";
import { renderActivity } from "../src/lib/activity/renderer.ts";

interface Row {
  id: string;
  position: number;
  payload: Record<string, unknown>;
  isCorrect: boolean;
}

function row(
  id: string,
  position: number,
  payload: Record<string, unknown>,
  isCorrect = false,
): Row {
  return { id, position, payload, isCorrect };
}

interface Stored {
  prompt: string;
  correctAnswer: unknown;
  options: Row[];
}

/** Kodekan fixture → bentuk penyimpanan per CONTENT-SPEC §7.2. */
function store(type: ActivityType): Stored {
  const f = activityTestFixtures[type];
  const prompt = "Petunjuk untuk anak.";

  switch (type) {
    case "TAP_ANSWER": {
      const items = (f as { items: Array<{ id: string; label: string; value?: string; isCorrect: boolean }> }).items;
      return {
        prompt,
        correctAnswer: null,
        options: items.map((it, i) =>
          row(it.id, i, { label: it.label, ...(it.value !== undefined ? { value: it.value } : {}) }, it.isCorrect),
        ),
      };
    }
    case "COUNT_OBJECTS": {
      const d = f as { objects: Array<{ id: string; visualKey: string; count: number }>; correctAnswer: number; maxAnswer?: number };
      return {
        prompt,
        correctAnswer: {
          correctAnswer: d.correctAnswer,
          ...(d.maxAnswer !== undefined ? { maxAnswer: d.maxAnswer } : {}),
        },
        options: d.objects.map((o, i) => row(o.id, i, { visualKey: o.visualKey, count: o.count })),
      };
    }
    case "MATCH":
      // §7.2: MATCH WAJIB jalur 1 (objek utuh); activity_option tidak dipakai.
      return { prompt, correctAnswer: f, options: [] };
    case "SEQUENCE": {
      const items = (f as { items: Array<{ id: string; label: string; visualKey?: string; correctPosition: number }> }).items;
      return {
        prompt,
        correctAnswer: null,
        options: items.map((it) =>
          row(
            it.id,
            it.correctPosition,
            { label: it.label, ...(it.visualKey !== undefined ? { visualKey: it.visualKey } : {}) },
          ),
        ),
      };
    }
    case "IDENTIFY_COLOR": {
      const d = f as { targetColorName: string; options: Array<{ id: string; colorValue: string; colorName: string; isCorrect: boolean }> };
      return {
        prompt,
        correctAnswer: { targetColorName: d.targetColorName },
        options: d.options.map((o, i) => row(o.id, i, { colorValue: o.colorValue, colorName: o.colorName }, o.isCorrect)),
      };
    }
    case "IDENTIFY_SHAPE": {
      const d = f as { options: Array<{ id: string; shapeKey: string; shapeName: string; isCorrect: boolean }> };
      // §7.2: target boleh dihilangkan → jatuh ke nama opsi yang benar.
      return {
        prompt,
        correctAnswer: null,
        options: d.options.map((o, i) => row(o.id, i, { shapeKey: o.shapeKey, shapeName: o.shapeName }, o.isCorrect)),
      };
    }
    case "MULTIPLE_CHOICE": {
      const d = f as { question: string; options: Array<{ id: string; label: string; isCorrect: boolean }> };
      return {
        prompt: d.question,
        correctAnswer: null,
        options: d.options.map((o, i) => row(o.id, i, { label: o.label }, o.isCorrect)),
      };
    }
    case "TRUE_FALSE":
      // §7.2: jalur 1 (objek utuh) — satu-satunya cara label kustom ikut
      // tersimpan; jalur 2 (boolean di correct_answer) diuji terpisah.
      return { prompt, correctAnswer: { ...f }, options: [] };
  }
}

function build(type: ActivityType, stored: Stored) {
  return content.buildActivityData({
    type,
    prompt: stored.prompt,
    correctAnswer: stored.correctAnswer,
    options: stored.options,
  });
}

const TYPES: ActivityType[] = [
  "TAP_ANSWER",
  "COUNT_OBJECTS",
  "MATCH",
  "SEQUENCE",
  "IDENTIFY_COLOR",
  "IDENTIFY_SHAPE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
];

test("§7.2 setiap tipe kembali menjadi ActivityData yang sama dengan fixture", () => {
  for (const type of TYPES) {
    const built = build(type, store(type));
    assert.ok(built, `${type}: konvensi penyimpanan gagal membentuk payload`);
    assert.deepEqual(built, activityTestFixtures[type], `${type}: payload hasil rebuild ≠ fixture`);
  }
});

test("§7.2 jalur 2 TRUE_FALSE (boolean) bekerja; label kustom hanya jalur 1", () => {
  const f = activityTestFixtures.TRUE_FALSE as import("../src/lib/activity/domain.ts").TrueFalseData;
  const plain = build("TRUE_FALSE", {
    prompt: f.statement,
    correctAnswer: f.correctAnswer,
    options: [],
  });
  assert.deepEqual(plain, { type: "true_false", statement: f.statement, correctAnswer: f.correctAnswer });

  // Label kustom (trueLabel/falseLabel) hanya lewat objek utuh di correct_answer.
  const labelled = build("TRUE_FALSE", { prompt: "x", correctAnswer: { ...f }, options: [] });
  assert.deepEqual(labelled, f);
});

test("§7.3 penilaian tiap tipe: jawaban sesuai dokumentasi diterima, jawaban lain ditolak", () => {
  const right: Record<ActivityType, unknown> = {
    TAP_ANSWER: "a",
    COUNT_OBJECTS: 5,
    MATCH: { l1: "r1", l2: "r2" },
    SEQUENCE: ["s1", "s2", "s3"],
    IDENTIFY_COLOR: "c1",
    IDENTIFY_SHAPE: "sh1",
    MULTIPLE_CHOICE: ["m1"],
    TRUE_FALSE: true,
  };
  const wrong: Record<ActivityType, unknown> = {
    TAP_ANSWER: "b",
    COUNT_OBJECTS: 4,
    MATCH: { l1: "r2", l2: "r1" },
    SEQUENCE: ["s3", "s2", "s1"],
    IDENTIFY_COLOR: "c2",
    IDENTIFY_SHAPE: "sh2",
    MULTIPLE_CHOICE: ["m2"],
    TRUE_FALSE: false,
  };

  for (const type of TYPES) {
    const built = build(type, store(type));
    assert.ok(built, `${type}: payload tidak terbentuk`);

    const ok = validateAnswer(type, built, right[type]);
    assert.equal(ok.isCorrect, true, `${type}: jawaban benar ditolak`);
    assert.ok(ok.explanation && ok.explanation.trim().length > 0, `${type}: tanpa penjelasan`);

    const no = validateAnswer(type, built, wrong[type]);
    assert.equal(no.isCorrect, false, `${type}: jawaban salah diterima`);
    assert.ok(no.explanation && no.explanation.trim().length > 0, `${type}: tanpa penjelasan saat salah`);
  }
});

test("§7.3 kasus gagal sesuai dokumentasi menghasilkan null (gagal aman)", () => {
  const f = activityTestFixtures;

  // MATCH tidak pernah dirakit dari activity_option.
  assert.equal(
    content.buildActivityData({
      type: "MATCH",
      prompt: "x",
      correctAnswer: null,
      options: [row("l1", 0, { label: "1" }), row("r1", 1, { label: "1" })],
    }),
    null,
    "MATCH jalur 2 wajib gagal aman",
  );

  // TRUE_FALSE hanya boolean JSON — jebakan Boolean("false") === true harus tertutup.
  assert.equal(build("TRUE_FALSE", { prompt: "Pernyataan", correctAnswer: "false", options: [] }), null);
  assert.equal(build("TRUE_FALSE", { prompt: "Pernyataan", correctAnswer: 1, options: [] }), null);
  assert.equal(
    build("TRUE_FALSE", { prompt: "Pernyataan", correctAnswer: { correctAnswer: true }, options: [] }),
    null,
    "objek tanpa kunci type bukan jalur 1 yang sah",
  );
  assert.equal(build("TRUE_FALSE", { prompt: "", correctAnswer: true, options: [] }), null, "prompt kosong ditolak");

  // MULTIPLE_CHOICE butuh pertanyaan non-kosong.
  assert.equal(
    build("MULTIPLE_CHOICE", { prompt: "", correctAnswer: null, options: [row("m1", 0, { label: "A" }, true), row("m2", 1, { label: "B" })] }),
    null,
  );

  // SEQUENCE: posisi bercelah (0,2) — tanpa 0..n-1 tanpa celah.
  assert.equal(
    build("SEQUENCE", {
      prompt: "x",
      correctAnswer: null,
      options: [row("s1", 0, { label: "1" }), row("s3", 2, { label: "3" })],
    }),
    null,
  );

  // IDENTIFY_COLOR: dua opsi benar → validator menolak.
  assert.equal(
    build("IDENTIFY_COLOR", {
      prompt: "x",
      correctAnswer: null,
      options: [
        row("c1", 0, { colorValue: "#ff0000", colorName: "merah" }, true),
        row("c2", 1, { colorValue: "#0000ff", colorName: "biru" }, true),
      ],
    }),
    null,
  );
});

test("§7.3 colorValue bukan heks tidak pernah masuk ke gaya renderer", () => {
  const html = renderActivity({
    activityId: "act-1",
    type: "IDENTIFY_COLOR",
    prompt: "Pilih warna merah",
    data: {
      type: "identify_color",
      targetColorName: "merah",
      options: [
        { id: "c1", colorValue: "red;position:fixed", colorName: "merah", isCorrect: true },
        { id: "c2", colorValue: "#0000ff", colorName: "biru", isCorrect: false },
      ],
    },
    explanation: null,
    childAge: 4,
    audioEnabled: false,
    reducedMotion: false,
  });
  assert.ok(!html.includes("red;position:fixed"), "nilai bukan-heks tidak boleh muncul di markup");
  assert.ok(html.includes("background:#0000ff"), "heks valid tetap dipakai");
});

test("§7.2 dokumentasi memuat baris tabel untuk kedelapan tipe (anti-drift)", () => {
  const doc = readFileSync(new URL("../docs/CONTENT-SPEC.md", import.meta.url), "utf8");
  const start = doc.indexOf("### 7.2 Per-type storage table");
  const end = doc.indexOf("### 7.3 Hard rules");
  assert.ok(start > -1 && end > start, "bagian §7.2 harus ada di docs/CONTENT-SPEC.md");
  const table = doc.slice(start, end);

  for (const type of TYPES) {
    assert.ok(table.includes(`| \`${type}\``), `tabel §7.2 tidak memuat baris ${type}`);
  }
  assert.ok(doc.includes("path 1"), "dokumen harus menjelaskan jalur objek utuh");
  assert.ok(doc.includes("Aktivitas Belum Siap"), "dokumen harus menjelaskan perilaku gagal aman");
});
