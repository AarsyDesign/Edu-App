import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Regresi temuan QA E2E 2026-10-10: baris meta sesi di ringkasan anak
 * (`/parent/anak/:id`) memuat tiga potong teks inline — "{n} jawaban",
 * durasi, dan "selesai {waktu}" — di dalam satu `<span class="session-meta-row">`
 * tanpa gaya apa pun. Induk `.session-meta` memang flex + gap, tetapi gap
 * tidak diwariskan ke anak inline di dalam satu flex item, sehingga yang tampil
 * "1 jawaban14 detikselesai 10 Oktober…" (dibuktikan di peramban: ketiga
 * rect menempel tanpa jarak).
 *
 * Aturan yang dikunci: `.session-meta-row` wajib menjadi flex + gap token
 * sendiri supaya potongan meta tetap terpisah walau teksnya panjang.
 */

const page = readFileSync(
  new URL("../src/pages/parent/anak/[id].astro", import.meta.url),
  "utf8",
);

test("baris meta sesi memisahkan jawaban/durasi/selesai dengan flex + gap token", () => {
  const style = page.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
  assert.ok(style, "blok gaya halaman tidak ditemukan");
  const rule = style.match(/\.session-meta-row\s*\{([^}]*)\}/);
  assert.ok(rule, ".session-meta-row wajib punya aturan gaya sendiri");
  assert.match(rule[1], /display\s*:\s*flex/, "harus display: flex");
  assert.match(rule[1], /gap\s*:\s*var\(--sp-/, "jarak memakai token spasi, bukan literal");
});

test("markup baris meta sesi tetap memuat tiga potong info (bakel regresi struktur)", () => {
  // Kalau struktur berubah jadi satu kalimat utuh, tes ini perlu disesuaikan
  // bersama gayanya — bukan dihapus diam-diam.
  const row = page.match(/<span class="session-meta-row">([\s\S]*?)<\/span>\s*<\/div>/);
  assert.ok(row, "span .session-meta-row tidak ditemukan di markup");
  assert.match(row[1], /jawaban/, "potongan jumlah jawaban hilang");
  assert.match(row[1], /formatDuration/, "potongan durasi hilang");
  assert.match(row[1], /session-ended/, "potongan waktu selesai hilang");
});
