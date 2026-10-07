/**
 * Kekuatan + saran latihan di ringkasan orang tua (VRD 10.4–10.5).
 *
 * Dua lapis:
 * 1. Unit murni `pickStrengths` / label skill — deterministik, tanpa ambang
 *    (VRD 9.5–9.7), UUID tidak pernah bocor ke tampilan.
 * 2. Pemindaian sumber halaman `/parent/anak/:id` — memastikan layar benar-
 *    benar memakai modul itu, punya empty state saran, dan memakai label
 *    tipe/tingkat yang sudah ada (bukan enum mentah / bintang).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SKILL_LABEL_UNKNOWN,
  STRENGTHS_LIMIT_DEFAULT,
  buildSkillLabels,
  getSkillLabel,
  pickStrengths,
} from "../src/lib/progress/strengths.ts";
import type { SkillAccuracy } from "../src/lib/progress/engine.ts";
import type { SkillWithArea } from "../src/lib/learning/areas-skills.ts";

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");
const page = read("src/pages/parent/anak/[id].astro");

/** Kode halaman tanpa komentar — komentar dokumen boleh menyebut kata terlarang. */
const pageCode = page
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

function skill(
  skillId: string,
  attempts: number,
  correct: number,
): SkillAccuracy {
  return {
    skillId,
    attempts,
    correct,
    accuracy: attempts > 0 ? correct / attempts : null,
    lastPracticedAt: new Date("2026-10-01T00:00:00Z"),
    masteredAt: null,
  };
}

test("pickStrengths: hanya skill berdata, urut akurasi lalu percobaan", () => {
  const input = [
    skill("s-rendah", 10, 4), // 40%
    skill("s-tinggi", 3, 3), // 100%
    skill("s-belum", 0, 0), // tanpa percobaan → gugur
    skill("s-sedang", 8, 6), // 75%
  ];
  const out = pickStrengths(input);
  assert.deepEqual(
    out.map((s) => s.skillId),
    ["s-tinggi", "s-sedang", "s-rendah"],
  );
});

test("pickStrengths: tiebreak deterministik (percobaan lalu skillId)", () => {
  const a = skill("bbb", 4, 2);
  const b = skill("aaa", 4, 2);
  const c = skill("ccc", 9, 5); // akurasi sama, percobaan lebih banyak → juara urutan
  const first = pickStrengths([a, b, c]).map((s) => s.skillId);
  const second = pickStrengths([c, b, a]).map((s) => s.skillId);
  assert.deepEqual(first, ["ccc", "aaa", "bbb"]);
  assert.deepEqual(first, second, "urutan masukan tidak boleh memengaruhi hasil");
});

test("pickStrengths: limit di luar rentang jatuh ke bawaan, input tidak berubah", () => {
  const input = [skill("a", 2, 2), skill("b", 2, 1), skill("c", 2, 0)];
  const snapshot = input.map((s) => s.skillId);
  assert.equal(pickStrengths(input, 0).length, STRENGTHS_LIMIT_DEFAULT);
  assert.equal(pickStrengths(input, 99).length, STRENGTHS_LIMIT_DEFAULT);
  assert.equal(pickStrengths(input, 1.5).length, STRENGTHS_LIMIT_DEFAULT);
  assert.equal(pickStrengths(input, 2).length, 2);
  assert.deepEqual(input.map((s) => s.skillId), snapshot, "masukan tidak boleh diurutkan di tempat");
  assert.equal(pickStrengths([]).length, 0, "data kosong → daftar kosong, bukan angka karangan");
});

function skillRow(skillId: string, title: string, areaTitle: string): SkillWithArea {
  return {
    skillId,
    learningAreaId: "area-1",
    learningAreaCode: "numbers",
    code: "count_basic",
    title,
    description: null,
    ageMin: 3,
    ageMax: 7,
    difficulty: 1,
    sortOrder: 1,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    learningAreaTitle: areaTitle,
  };
}

test("label skill: UUID diterjemahkan; skill hilang tidak membalikkan UUID", () => {
  const labels = buildSkillLabels([
    skillRow("11111111-2222-3333-4444-555555555555", "Hitung Benda 1-5", "Angka & Hitungan"),
  ]);
  const known = getSkillLabel(labels, "11111111-2222-3333-4444-555555555555");
  assert.equal(known.skillTitle, "Hitung Benda 1-5");
  assert.equal(known.areaTitle, "Angka & Hitungan");

  const missing = getSkillLabel(labels, "99999999-8888-7777-6666-555555555555");
  assert.equal(missing.skillTitle, SKILL_LABEL_UNKNOWN);
  assert.equal(missing.areaTitle, null);
  assert.ok(!missing.skillTitle.includes("99999999"), "UUID tidak boleh tampil sebagai judul");
});

test("halaman memakai modul kekuatan, bukan UUID mentah", () => {
  assert.ok(page.includes("pickStrengths"), "seleksi kekuatan wajib lewat modul (VRD 10.4)");
  assert.ok(page.includes("getSkillLabel"), "judul skill wajib dari peta label");
  assert.ok(page.includes("listAllSkillsWithArea"), "label diambil dari sumber area+skill");
  assert.ok(!pageCode.includes("{skill.skillId}"), "UUID skill tidak boleh dirender sebagai teks");
  assert.ok(
    !pageCode.includes('skill.skillId.split("-")'),
    "pencarian area dari UUID sudah tidak valid (areaId juga UUID)",
  );
  // ukuran sampel ikut ditampilkan — orang tua bisa menilai kepercayaan angka
  assert.ok(page.includes("{skill.attempts} jawaban"), "jumlah percobaan wajib tampil");
});

test("saran latihan: label konsisten + empty state saat tidak ada kandidat", () => {
  assert.ok(page.includes("getActivityTypeLabel"), "tipe aktivitas wajib memakai label yang ada");
  assert.ok(page.includes("getDifficultyLabel"), "tingkat wajib memakai label yang ada");
  assert.ok(
    !/Tipe:\s*\{/.test(pageCode),
    "enum tipe mentah tidak boleh tampil ke orang tua",
  );
  assert.ok(page.includes("suggestion-empty"), "saran kosong wajib punya empty state");
  assert.ok(
    page.includes("Belum ada aktivitas terbit"),
    "teks empty state saran harus jujur tentang penyebabnya",
  );
  // tautan saran harus menunjuk rute layar aktivitas yang benar-benar ada
  assert.ok(read("src/pages/learn/aktivitas/[id].astro").includes("Astro.params.id"));
});
