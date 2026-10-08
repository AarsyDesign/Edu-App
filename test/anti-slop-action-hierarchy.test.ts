/**
 * Gerbang hierarki aksi anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui).
 *
 * DESIGN.md: `button-primary` adalah satu-satunya aksi high-emphasis per
 * layar. QA E2E eksploratif 2026-10-08 menemukan dua layar reviewer dan
 * ringkasan anak orang tua yang memakai dua `.btn-primary` sekaligus; tes
 * ini mengunci perbaikannya supaya tidak kembali diam-diam.
 *
 * Cakupan: layar reviewer + `/parent/anak/[id]` (OQ 28, ditutup 2026-10-08).
 * Dua `btn-primary` statis di berkas ringkasan anak itu sah karena berada
 * di cabang `hasData ? … : …` yang saling eksklusif — yang diuji: cabang
 * berdata hanya punya "Mulai Aktivitas Ini", dan CTA header memakai
 * sekunder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (rel: string): Promise<string> => readFile(new URL(rel, import.meta.url), "utf8");

test("17.x daftar aktivitas: tepat satu aksi primary, impor memakai sekunder", async () => {
  const src = await read("../src/pages/reviewer/aktivitas/index.astro");
  const primaryCount = (src.match(/class="btn-primary"/g) ?? []).length;
  assert.equal(primaryCount, 1, `daftar memakai ${primaryCount} btn-primary, maksimal 1`);
  assert.ok(
    /class="btn-secondary" href="\/reviewer\/aktivitas\/impor"/.test(src),
    "Impor Draf AI harus aksi sekunder",
  );
  assert.ok(
    /class="btn-primary" href="\/reviewer\/aktivitas\/baru"/.test(src),
    "Buat Aktivitas Baru tetap aksi utama",
  );
});

test("17.x panel alur review: tanpa aksi primary di layar edit", async () => {
  const panel = await read("../src/components/ReviewFlowPanel.astro");
  assert.ok(!panel.includes("btn-primary"), "panel tidak boleh memakai btn-primary");
  assert.ok(
    panel.includes('transition.kind === "primary" ? "btn-secondary" : "btn-tertiary"'),
    "langkah maju = sekunder, langkah mundur = tersier",
  );
  // Tetap target sentuh & tanpa nilai visual hardcoded.
  assert.ok(panel.includes("min-height: 52px"), "tombol transisi tetap ≥44px");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(panel), "warna hardcoded di panel");
  assert.ok(!/\d+ms\b/.test(panel), "durasi ms hardcoded di panel");
});

test("17.x layar edit: aksi primary tunggal ada di formulir (Simpan)", async () => {
  const form = await read("../src/components/ActivityEditorForm.astro");
  assert.ok(
    /class="btn-primary"[\s\S]{0,80}Simpan/.test(form),
    "tombol simpan tetap satu-satunya aksi primary layar edit",
  );
});

test("17.x skip-link mencapai target sentuh minimum", async () => {
  const layout = await read("../src/layouts/BaseLayout.astro");
  const block = layout.slice(layout.indexOf(".skip-link"), layout.indexOf(".skip-link:focus"));
  assert.ok(
    block.includes("min-height: var(--touch-min)"),
    "skip-link harus setinggi --touch-min (44px)",
  );
});

test("17.x ringkasan anak (OQ 28): CTA header sekunder, satu primary per cabang", async () => {
  const src = await read("../src/pages/parent/anak/[id].astro");
  // CTA header "Buka layar belajar" turun ke sekunder (Keputusan OQ 28).
  assert.ok(
    /class="btn-secondary" href=\{learnUrl\}/.test(src),
    "Buka layar belajar harus memakai btn-secondary",
  );
  assert.ok(
    !/class="btn-primary" href=\{learnUrl\}>Buka layar belajar/.test(src),
    "CTA header tidak boleh primary (cabang berdata)",
  );
  // Cabang berdata: hanya saran latihan yang primary; cabang kosong: satu primary.
  const primaries = src.match(/class="btn-primary"[^>]*>[^<]*/g) ?? [];
  assert.equal(primaries.length, 2, `ditemukan ${primaries.length} btn-primary di berkas`);
  assert.ok(
    primaries.some((p) => p.includes("/learn/aktivitas/")),
    "\"Mulai Aktivitas Ini\" tetap aksi utama",
  );
  assert.ok(
    primaries.some((p) => p.includes("Mulai Belajar")),
    "empty state tetap punya satu aksi utama",
  );
  // Sekunder: token saja, target sentuh, durasi lewat token.
  const style = src.slice(src.indexOf("<style>"));
  assert.ok(style.includes(".btn-secondary"), "gaya btn-secondary didefinisikan di halaman");
  assert.ok(
    style.includes("min-height: var(--touch-min)"),
    "target sentuh btn-secondary ≥44px",
  );
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(style), "warna hardcoded di blok style");
  assert.ok(!/[0-9]ms\b/.test(style), "durasi ms hardcoded di blok style");
  // Hover sekunder: cincin token, bukan latar --c-warning (ink di atas
  // warning hanya 4,43:1 — di bawah WCAG AA).
  const secondaryHover = style.slice(
    style.indexOf(".btn-secondary:hover"),
    style.indexOf(".btn-secondary:active"),
  );
  assert.ok(
    secondaryHover.includes("inset 0 0 0 2px var(--c-ink)"),
    "hover btn-secondary memakai cincin --c-ink",
  );
  assert.ok(
    !secondaryHover.includes("background: var(--c-warning)"),
    "latar warning tidak layak untuk teks (4,43:1)",
  );
});

test("17.x kartu profil: hover aksi sekunder tidak memakai latar warning", async () => {
  const card = await read("../src/components/ChildProfileCard.astro");
  const hover = card.slice(
    card.indexOf(".btn-secondary:hover"),
    card.indexOf(".btn-secondary:active"),
  );
  assert.ok(
    !hover.includes("background: var(--c-warning)"),
    "latar --c-warning dengan teks ink hanya 4,43:1 (gagal WCAG AA)",
  );
  assert.ok(
    hover.includes("inset 0 0 0 2px var(--c-ink)"),
    "hover sekunder memakai cincin --c-ink (token)",
  );
});
