import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Gerbang status jaringan lambat (VRD 16.15, temuan QA E2E eksploratif
 * 2026-10-10).
 *
 * Temuan yang dikunci di sini (diukur di peramban dengan respons tertunda
 * 4–5 detik, bukan ditebak):
 *
 * 1. Saat jawaban dikirim, layar aktivitas hanya mematikan tombol dan
 *    mengisi cincin kemajuan 100% — tanpa satu pun teks status. DESIGN-SYSTEM
 *    §11 mewajibkan keadaan loading; tanpa teks, anak 3–7 hanya melihat layar
 *    yang berhenti merespons, dan angka 100% mengklaim sesuatu yang belum
 *    diperiksa server (skill antislop-ui: Evidence over claims).
 * 2. Tombol "Aktivitas Berikutnya"/"Beranda" menunggu balasan
 *    `/api/session/complete` sebelum pindah halaman (terukur: 5,1 detik
 *    menetap di layar yang sama) — padahal permintaan sudah memakai
 *    `keepalive` sehingga bisa hidup setelah halaman berganti.
 *
 * Aturan yang dikunci:
 * - selama menunggu penilaian ada pesan `role="status"` berisi teks menunggu
 *   dengan nada info (permukaan biru lembut, bukan permukaan galat);
 * - cincin kemajuan hanya mencapai 100% setelah umpan balik tampil;
 * - `leaveSession` tidak menahan navigasi sampai penutupan sesi dibalas.
 */

const root = new URL("../", import.meta.url).pathname;
const runtime = readFileSync(`${root}public/activity/runtime.js`, "utf8");
const activityCss = readFileSync(`${root}src/styles/activity.css`, "utf8");

/** Ambil isi fungsi berdasar tanda kurung kurawal seimbang. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `fungsi ${name} tidak ditemukan`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`fungsi ${name} tidak tertutup`);
}

const submit = functionBody(runtime, "submitAnswer");
const leave = functionBody(runtime, "leaveSession");

test("16.15: menunggu penilaian ditandai teks status, bukan tombol mati saja", () => {
  assert.ok(submit.length > 400, "ekstraksi submitAnswer tidak kosong");
  const noticeIdx = submit.indexOf('showNotice(root, "Memeriksa jawaban…"');
  assert.ok(noticeIdx >= 0, "ada pesan menunggu saat jawaban dikirim");
  const fetchIdx = submit.indexOf("await fetch(");
  assert.ok(fetchIdx >= 0, "jawaban tetap dikirim ke server");
  assert.ok(
    noticeIdx < fetchIdx,
    "pesan menunggu tampil sebelum permintaan dikirim (bukan setelah)",
  );
  assert.ok(
    submit.includes('"info"'),
    "pesan menunggu memakai nada info, bukan permukaan galat",
  );
  // Pesan menunggu berupa teks yang bisa dibaca, bukan status lewat warna saja.
  const notice = functionBody(runtime, "showNotice");
  assert.ok(
    notice.includes('notice.setAttribute("role", "status")'),
    "pesan status diumumkan pembaca layar",
  );
});

test("16.15: cincin kemajuan tidak mengklaim 100% sebelum server menjawab", () => {
  const semua = [...runtime.matchAll(/setProgress\(root, 100\)/g)].map(
    (m) => m.index ?? 0,
  );
  assert.equal(
    semua.length,
    1,
    "hanya satu titik yang boleh menyetel kemajuan 100%",
  );
  const feedback = functionBody(runtime, "showFeedback");
  assert.ok(
    feedback.includes("setProgress(root, 100)"),
    "kemajuan 100% diberikan bersama umpan balik",
  );
  assert.ok(
    !submit.includes("setProgress(root, 100)"),
    "submitAnswer tidak menyetel 100% sebelum balasan server",
  );
  // Umpan balik menggantikan pesan menunggu — keduanya tidak tampil bersamaan.
  assert.ok(feedback.includes("clearNotice(root)"));
});

test("16.15: penutupan sesi tidak menahan anak di layar aktivitas", () => {
  assert.ok(leave.length > 150, "ekstraksi leaveSession tidak kosong");
  assert.ok(
    leave.includes("/api/session/complete"),
    "sesi tetap ditutup saat anak pindah",
  );
  assert.ok(leave.includes("keepalive: true"), "permintaan hidup setelah pindah halaman");
  assert.ok(
    !leave.includes("await "),
    "leaveSession tidak menunggu balasan server",
  );
  assert.ok(
    !/\.then\(/.test(leave),
    "navigasi tidak disambung pada penutupan sesi",
  );
  const navigasi = leave.indexOf("window.location.assign(targetUrl)");
  assert.ok(navigasi >= 0, "ada perpindahan halaman");
  assert.ok(
    leave.lastIndexOf("window.location.assign(targetUrl)") > leave.indexOf("fetch("),
    "permintaan penutupan dikirim lebih dulu, navigasi dijalankan tanpa menunggu",
  );
  // Pratinjau reviewer tetap tanpa sesi anak.
  assert.ok(leave.includes("if (cfg.preview === true)"));
});

test("16.15: permukaan pesan menunggu hanya token + tanpa jargon internal", () => {
  const blok = activityCss.match(/\.notice--info\s*\{[^}]*\}/);
  assert.ok(blok, "aturan .notice--info ada di gaya aktivitas");
  const css = blok[0];
  assert.ok(css.includes("var(--c-soft-blue)"), "latar info memakai token biru lembut");
  assert.ok(css.includes("var(--c-ink)"), "teks memakai token ink");
  assert.ok(!/#[0-9a-f]{3,8}/i.test(css), "tanpa warna heksa hardcoded");
  assert.ok(!/\d+ms/.test(css), "tanpa durasi ms hardcoded");

  // Salinan menunggu: bahasa Indonesia, tanpa jargon, tanpa label lomba.
  // Komentar kode dibuang dulu — gerbang ini menilai teks yang dibaca anak.
  const tanpaKomentar = submit
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const teksMenunggu = runtime.match(/Memeriksa jawaban…/g) ?? [];
  assert.ok(teksMenunggu.length >= 1);
  assert.ok(
    !/Phase|VRD|OQ|MVP|PRD|leaderboard|peringkat|\bpoin\b/i.test(tanpaKomentar),
    "pesan ke anak tanpa jargon internal / label kompetisi",
  );
});
