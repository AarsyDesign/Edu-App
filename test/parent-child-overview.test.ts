/**
 * Gerbang UI ringkasan anak (VRD 10.1 — child overview).
 *
 * Memastikan layar baru: dikunci gerbang kepemilikan di server, memakai
 * agregasi fakta VRD 9.8 tanpa ambang/label baru, hanya token desain,
 * tanpa kata lomba (VRD 9.6/9.7), punya empty state, dan benar-benar
 * ditautkan dari kartu profil di dashboard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");

const page = read("src/pages/parent/anak/[id].astro");
const card = read("src/components/ChildProfileCard.astro");
const tokens = read("src/styles/tokens.css");

/** Kode halaman tanpa komentar — komentar dokumen boleh menyebut kata terlarang. */
const pageCode = page
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("halaman ringkasan ada dan mengunci kepemilikan di server", () => {
  assert.ok(page.includes("getParentProgressSummary"), "harus memakai agregasi VRD 9.8");
  assert.ok(page.includes("getChildForParent"), "kepemilikan wajib lewat gerbang VRD 3.7");
  assert.ok(page.includes('Astro.redirect("/login")'), "tanpa sesi harus ke /login");
  assert.ok(page.includes('Astro.redirect("/parent")'), "id asing/tidak ada harus ke /parent");
  assert.ok(page.includes('mode="parent"'));
  // id anak hanya dari parameter rute yang sudah diverifikasi — bukan query klien
  assert.ok(!/searchParams\.get\(["']child/.test(page), "id anak tidak boleh dari query string");
});

test("ringkasan hanya membaca fakta yang sudah ada (tanpa ambang/label baru)", () => {
  assert.ok(page.includes("getParentProgressSummary"));
  // tidak ada tulis sama sekali di halaman
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/.test(pageCode), "halaman ringkasan wajib murni baca");
  // tidak ada ambang mastery/akurasi yang dikarang (VRD 9.6)
  assert.ok(!/mastered_at\s*=|threshold|ambang/i.test(pageCode));
  // kata lomba/lulus-gagal dilarang (VRD 9.6/9.7, PRD §9)
  const forbidden =
    /\b(lulus|gagal|peringkat|leaderboard|ranking|juara|nilai tertinggi|skor)\b/i;
  assert.ok(!forbidden.test(pageCode), "keluaran ringkasan tidak boleh berlabel kompetitif");
});

test("tiga fakta utama ditampilkan sebagai teks, bukan warna saja", () => {
  for (const label of ["Jawaban tersimpan", "Skill dipraktikkan", "Sesi belajar"]) {
    assert.ok(page.includes(label), `label fakta "${label}" hilang`);
  }
  // empty state untuk anak yang belum pernah berlatih (bukan angka nol acak)
  assert.ok(page.includes("Belum ada latihan"), "empty state wajib ada");
  // durasi sesi ditampilkan (PRD §12: session duration)
  assert.ok(page.includes("formatDuration"), "durasi sesi harus diformat manusiawi");
});

test("hanya token desain — tanpa nilai visual hardcoded", () => {
  const hexes = page.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hexes, [], `nilai hex hardcoded ditemukan: ${hexes.join(", ")}`);

  const tokenNames = new Set(
    [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
  const used = [...page.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0, "harus memakai token");
  for (const name of used) {
    assert.ok(tokenNames.has(name), `token ${name} tidak ada di tokens.css`);
  }
  // touch target wajib untuk aksi utama (DESIGN-SYSTEM §12)
  assert.ok(page.includes("--touch-min"), "tombol utama wajib `--touch-min`");
});

test("kartu profil menautkan ringkasan ke rute yang benar-benar ada", () => {
  assert.ok(card.includes("/parent/anak/"), "kartu profil wajib menautkan ringkasan");
  assert.ok(card.includes('data-action="summary"'));
  assert.ok(page.includes("← Kembali ke Area Orang Tua"), "tautan kembali wajib ada");
});
