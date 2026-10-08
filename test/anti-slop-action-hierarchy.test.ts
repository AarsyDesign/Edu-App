/**
 * Gerbang hierarki aksi anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui).
 *
 * DESIGN.md: `button-primary` adalah satu-satunya aksi high-emphasis per
 * layar. QA E2E eksploratif 2026-10-08 menemukan dua layar reviewer yang
 * memakai dua `.btn-primary` sekaligus; tes ini mengunci perbaikannya supaya
 * tidak kembali diam-diam.
 *
 * Fokus: layar reviewer (cakupan run QA itu). Layar orang tua
 * `/parent/anak/[id]` masih memuat dua aksi primary — tercatat sebagai
 * temuan terbuka di docs/IMPLEMENTATION-AUDIT.md, bukan ditambal diam-diam.
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
