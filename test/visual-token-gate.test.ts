import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Gerbang nilai visual (Phase 17 — Anti-Slop Visual QA).
 *
 * Konteks run 2026-10-09: child home (`src/pages/learn.astro`) dan kartu profil
 * (`src/components/ChildProfileCard.astro`) masih memuat hex hardcoded pada
 * atribut SVG (`stroke="#174A3A"`, `fill="#E85D4D"` — yang terakhir bahkan di
 * luar palet DESIGN.md) plus satu latar `linear-gradient` di `.activity-visual`
 * (DESIGN-SYSTEM §3.8: hindari gradien sebagai latar bawaan). Gerbang lama
 * hanya memeriksa blok `<style>` per komponen, jadi markup lolos tanpa diperiksa.
 *
 * Aturan yang dikunci di sini:
 * 1. Semua `.astro` di `src/` bebas literal heksa — nilai visual hanya lewat
 *    `var(--…)` dari `src/styles/tokens.css` / `currentColor`.
 * 2. Tanpa `gradient(` di markup maupun gaya (kecuali `tokens.css`, sumber token).
 * 3. Layar anak memakai `currentColor` + container yang menyetel warnanya,
 *    supaya ikon tidak jatuh ke warna warisan yang tak terduga.
 */

const root = new URL("../", import.meta.url).pathname;

/**
 * Literal konten, bukan gaya: benih `colorValue` pada editor reviewer
 * (`ActivityEditorForm.astro`) memakai heksa huruf kecil dan dikecualikan
 * dengan pencocokan case-sensitif — heksa besar seperti `#174A3A` di atribut
 * SVG tetap tertangkap gerbang ini.
 */
const CONTENT_SEEDS = ["#174a3a"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const astroFiles = walk(join(root, "src")).filter((f) => f.endsWith(".astro"));
const styleFiles = [
  ...walk(join(root, "src/styles")),
].filter((f) => !f.endsWith("tokens.css"));

function rel(path: string): string {
  return relative(root, path);
}

test("markup & gaya: tanpa warna heksa hardcoded di luar token", () => {
  assert.ok(astroFiles.length >= 20, "inventaris .astro berubah — periksa gerbang");
  const offenders: string[] = [];
  for (const file of astroFiles) {
    let text = readFileSync(file, "utf8");
    for (const seed of CONTENT_SEEDS) text = text.split(seed).join("");
    const hexes = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    if (hexes.length > 0) offenders.push(`${rel(file)}: ${hexes.join(" ")}`);
  }
  for (const file of styleFiles) {
    const hexes = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    if (hexes.length > 0) offenders.push(`${rel(file)}: ${hexes.join(" ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `nilai warna hardcoded di luar tokens.css:\n${offenders.join("\n")}`,
  );
});

test("latar: tanpa gradien sebagai latar bawaan (DESIGN-SYSTEM §3.8)", () => {
  const offenders: string[] = [];
  for (const file of [...astroFiles, ...styleFiles]) {
    if (/gradient\(/.test(readFileSync(file, "utf8"))) offenders.push(rel(file));
  }
  assert.deepEqual(offenders, [], `gradien dekoratif ditemukan di: ${offenders.join(", ")}`);
});

test("layar anak & kartu profil: garis SVG memakai currentColor berpasangan token", async () => {
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const home = read("src/pages/learn.astro");
  const card = read("src/components/ChildProfileCard.astro");

  for (const [name, src] of [
    ["child home", home],
    ["kartu profil", card],
  ] as const) {
    assert.ok(!/stroke="#/.test(src), `${name}: garis SVG masih memakai hex`);
    assert.ok(src.includes('stroke="currentColor"'), `${name}: garis SVG pakai currentColor`);
  }

  // Container yang menyetel warna warisan ikon (currentColor tidak boleh jatuh
  // ke warna teks sembarang).
  assert.match(home, /\.child-info \.avatar-wrap[\s\S]{0,240}color: var\(--c-deep-green\)/);
  assert.match(home, /\.empty-state \.mark \{[\s\S]{0,120}color: var\(--c-deep-green\)/);
  assert.match(card, /\.avatar-wrap \{[\s\S]{0,240}color: var\(--c-deep-green\)/);

  // String SVG disuntik lewat set:html — Astro meng-escape `{expr}`, sehingga
  // tanpa itu ikon tampil sebagai teks literal "<svg …>" (temuan QA E2E run ini).
  const bareHome = home.replace(/set:html=\{[^}]*\}/g, "");
  const bareCard = card.replace(/set:html=\{[^}]*\}/g, "");
  assert.ok(home.includes("set:html={getAreaIcon("), "ikon area harus disuntik set:html");
  assert.ok(home.includes("set:html={getActivityVisual("), "visual aktivitas harus disuntik set:html");
  assert.ok(card.includes("set:html={avatar}"), "avatar kartu profil harus disuntik set:html");
  assert.ok(!/\{getAreaIcon\(/.test(bareHome), "getAreaIcon dipanggil tanpa set:html");
  assert.ok(!/\{getActivityVisual\(/.test(bareHome), "getActivityVisual dipanggil tanpa set:html");
  assert.ok(!/\{avatar\}/.test(bareCard), "avatar kartu profil dipanggil tanpa set:html");

  // Ilustrasi IDENTIFY_COLOR hanya memakai token palet.
  const identify = /IDENTIFY_COLOR: `([^`]+)`/.exec(home);
  assert.ok(identify, "visual IDENTIFY_COLOR tidak terbaca");
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(identify[1]), "visual IDENTIFY_COLOR memuat hex");
  assert.match(identify[1], /var\(--c-soft-peach\)/);
  assert.match(identify[1], /var\(--c-warm-yellow\)/);

  // Latar hero aktivitas = permukaan solid token, bukan gradien.
  assert.match(home, /\.activity-visual \{[\s\S]{0,220}background: var\(--c-soft-green\)/);
});
