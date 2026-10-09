/**
 * Gerbang copy: jargon internal roadmap tidak boleh bocor ke layar pengguna.
 *
 * Konteks: 2026-10-08 menemukan "akan hadir di Phase 10" di dashboard orang
 * tua (jargon internal). Tiga halaman placeholder pengaturan (VRD
 * 10.7/10.8/10.10) lalu ikut terbukti memuat rujukan "PRD §…", "VRD …",
 * "OQ …" pada teks yang dibaca orang tua/reviewer.
 *
 * Aturan: seluruh `src/` — markup maupun pesan API — bebas identifier
 * roadmap internal. Komentar dokumen dikecualikan (memang untuk pengembang).
 * Rujukan ke dokumen produk hanya hidup di docs/, bukan di layar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname);

/** Seluruh berkas sumber yang bisa memuat copy (markup atau pesan galat/sukses). */
const sourceFiles: string[] = [];
(function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(astro|ts|tsx|html)$/.test(entry)) sourceFiles.push(full);
  }
})(path.join(root, "src"));

/** Komentar dibuang — rujukan VRD/OQ/PRD di komentar dokumen itu sah. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JARGON = /\b(Phase\s+\d+|VRD\s+\d+|OQ\s+\d+|MVP|PRD\s*§\d*)\b/;

test("copy src/ bebas jargon internal roadmap (tanpa Phase/VRD/OQ/MVP/PRD)", () => {
  // Walker tidak boleh kosong diam-diam (anti-vacuous).
  assert.ok(sourceFiles.length >= 70, `hanya ${sourceFiles.length} berkas terpinda`);

  const hits: string[] = [];
  for (const file of sourceFiles) {
    const code = stripComments(readFileSync(file, "utf8"));
    const match = code.match(JARGON);
    if (match) {
      const at = code.indexOf(match[0]);
      hits.push(
        `${path.relative(root, file)} → ${JSON.stringify(
          code.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, " "),
        )}`,
      );
    }
  }
  assert.deepEqual(hits, [], `jargon internal bocor ke copy:\n${hits.join("\n")}`);
});

test("detektor tidak vakum — pola mengenali jargon pada contoh", () => {
  for (const sample of [
    "Aktivitas ini akan hadir di Phase 13",
    "Sesuai VRD 10.7 layar ini…",
    "menunggu keputusan (OQ 18)",
    "belum ada di MVP",
    "aturan PRD §12",
  ]) {
    assert.ok(JARGON.test(sample), `contoh tak terdeteksi: ${sample}`);
  }
  // komentar dokumen memang dikecualikan
  assert.equal(stripComments("/** lihat VRD 12.6 */\nconst x = 1;").match(JARGON), null);
});

test("halaman placeholder pengaturan menyatakan ketersediaan lewat teks, bukan warna", () => {
  const pages: Array<[string, RegExp]> = [
    ["src/pages/parent/pengaturan/audio.astro", /Pengaturan audio belum tersedia/],
    ["src/pages/parent/pengaturan/sesi.astro", /Pengaturan durasi sesi belum tersedia/],
    ["src/pages/parent/pengaturan/privasi.astro", /Belum tersedia/],
  ];
  for (const [file, statusText] of pages) {
    const raw = readFileSync(path.join(root, file), "utf8");
    const code = stripComments(raw);
    assert.match(code, statusText, `${file}: status ketersediaan wajib berupa teks`);
    // rujukan berkas internal dokumen juga tidak boleh tampil
    assert.ok(
      !/(PRIVACY-AUDIT|SECURITY-PRIVACY|IMPLEMENTATION-AUDIT|DESIGN-SYSTEM)\.md/.test(code),
      `${file}: nama berkas internal bocor ke layar`,
    );
    // tanpa JUDUL/teks yang menyembunyikan ketersediaan lewat warna saja:
    // elemen status wajib memuat teks (span/heading), bukan dot tanpa label
    assert.ok(!/<span[^>]*class="[^"]*(?:dot|status-dot)/i.test(code), `${file}: dot status berwarna tanpa teks`);
  }
});
