/**
 * Gerbang kepadatan dashboard orang tua (VRD 10.9 — "Keep dashboard low-density").
 *
 * Kebutuhan:
 *   - PRD §12: dashboard memuat child profiles, activities completed, session
 *     duration, skill progress, recommended practice, settings — dan
 *     "Avoid excessive analytics in MVP".
 *   - PRD §10/§22: tanpa competitive leaderboard; parent melihat progress
 *     dasar tanpa widget kesombongan (vanity metrics).
 *   - PRD §19: tanpa pihak ketiga di jalur runtime.
 *
 * Strategi: kunci INVENTARIS bagian (menambah panel analytics baru harus
 * diedit sadar-sadar di sini), bukan angka kabur. Pengukuran kata/tinggi
 * halaman tercatat di docs/IMPLEMENTATION-AUDIT.md sebagai bukti, bukan
 * sebagai ambang yang dikarang.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");

const dashboard = read("src/pages/parent.astro");
const overview = read("src/pages/parent/anak/[id].astro");

/** Kode halaman tanpa komentar — komentar dokumen boleh menyebut VRD/OQ/Phase. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const dashCode = stripComments(dashboard);
const overviewCode = stripComments(overview);

/** Teks literal di dalam tag heading (markup statis, bukan nilai dinamis). */
const headingTexts = (src: string, tag: string) =>
  [...src.matchAll(new RegExp(`<${tag}[^>]*>([^<{]+)</${tag}>`, "g"))].map((m) =>
    m[1].trim(),
  );

test("10.9 dashboard: inventaris bagian = daftar PRD §12 (tanpa panel analytics tambahan)", () => {
  // Bagian tetap dashboard orang tua — menambah panel baru wajib memperbarui
  // daftar ini secara sadar, supaya "excessive analytics" tidak masuk diam-diam.
  assert.deepEqual(
    headingTexts(dashCode, "h2").sort(),
    ["Pengaturan", "Profil Anak Aktif", "Profil Diarsipkan"].sort(),
    "bagian dashboard berubah — pastikan tetap sesuai PRD §12 tanpa widget tambahan",
  );
  assert.deepEqual(
    headingTexts(dashCode, "h3").sort(),
    ["Belum ada profil anak", "Data & Privasi", "Durasi Sesi", "Preferensi Audio"].sort(),
    "kartu pengaturan berubah (10.7/10.8/10.10 menunggu keputusan produk)",
  );
  // pengaturan memang tampil (PRD §12 "settings")
  assert.ok(dashCode.includes(">Pengaturan<"));
});

test("10.9 ringkasan anak: hanya fakta + riwayat + area + kekuatan + saran", () => {
  const allowed = new Set([
    "Riwayat Sesi",
    "Area Belajar",
    "Kekuatan",
    "Saran Latihan Berikutnya",
    "Belum ada latihan", // empty state (VRD 10.1) — bukan bagian tambahan
  ]);
  const extras = headingTexts(overviewCode, "h2").filter((h) => !allowed.has(h));
  assert.deepEqual(extras, [], `bagian tak dikenal di ringkasan: ${extras.join(", ")}`);

  // PRD §12: activities completed + session duration + skill progress = 3 fakta
  for (const label of ["Jawaban tersimpan", "Skill dipraktikkan", "Sesi belajar"]) {
    assert.ok(overviewCode.includes(`<dt>${label}</dt>`), `label fakta "${label}" hilang`);
  }
  // PRD §12: recommended practice
  assert.ok(overviewCode.includes("Saran Latihan Berikutnya"));
  // PRD §10: tanpa competitive leaderboard
  assert.ok(!headingTexts(overviewCode, "h2").some((h) => /poin|peringkat|streak/i.test(h)));
});

test("10.9 tanpa widget kesombongan & tanpa pihak ketiga di dashboard", () => {
  for (const [name, code] of [
    ["dashboard", dashCode],
    ["ringkasan", overviewCode],
  ] as const) {
    // Vanity/otomatisasi analytics: canvas chart, widget eksternal, tracker
    assert.ok(!/<canvas/i.test(code), `${name}: <canvas> = widget grafik, dilarang PRD §12`);
    assert.ok(!/<iframe/i.test(code), `${name}: <iframe> bukan bagian MVP`);
    assert.ok(
      !/\b(gtag|dataLayer|analytics|mixpanel|hotjar|facebook|pixel|matomo)\b/i.test(code),
      `${name}: penjejak pihak ketiga dilarang (PRD §19 single deployable, §14 minimisasi)`,
    );
    // aset/pautan sumber luar di dua layar dashboard
    assert.ok(!/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(code), `${name}: URL eksternal`);
    // tanpa elemen angka-kesombongan pada copy
    assert.ok(
      !/\b(leaderboard|peringkat|ranking|juara|streak|hari beruntun|xp|poin|medali)\b/i.test(
        code,
      ),
      `${name}: copy kompetitif/kesombongan dilarang (PRD §10, VRD 9.6/9.7)`,
    );
  }
});

test("10.9 copy dashboard tanpa jargon internal (VRD/OQ/Phase/MVP)", () => {
  const jargon = /\b(Phase\s+\d+|VRD\s+\d+|OQ\s+\d+|MVP)\b/;
  for (const [name, code] of [
    ["dashboard", dashCode],
    ["ringkasan", overviewCode],
  ] as const) {
    const hit = code.match(jargon);
    assert.equal(hit, null, `${name}: jargon internal bocor ke copy pengguna → "${hit?.[0]}"`);
  }
});
