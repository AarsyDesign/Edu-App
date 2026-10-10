import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Gerbang "[hidden] kalah dari gaya kelas" (temuan QA E2E 2026-10-10).
 *
 * Temuan: banner offline di `src/pages/learn.astro` memakai atribut `hidden`
 * yang diatur JS (`banner.hidden = navigator.onLine`), tetapi blok gayanya
 * menyetel `display: flex` pada kelas yang sama. Dalam CSS, lembar gaya
 * penulis selalu menang atas gaya bawaan browser `[hidden] { display: none }`
 * — bahkan tanpa spesifisitas lebih tinggi — sehingga banner tampil
 * terus-menerus walau atribut `hidden` terpasang (status palsu: "kamu sedang
 * offline" padahal daring).
 *
 * Aturan yang dikunci: kelas mana pun yang (a) dipakai pada elemen yang
 * membawa atribut `hidden` di markup, dan (b) punya aturan `display:` di blok
 * gaya, wajib memuat aturan turunan `.kelas[hidden]` yang menetralkannya
 * (pola yang sudah dipakai `.archive-status`, `.type-panel`, `.btn-tertiary`).
 */

const root = new URL("../", import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(path: string): string {
  return relative(root, path);
}

const astroFiles = walk(join(root, "src")).filter((f) => f.endsWith(".astro"));

/** Ambil isi blok <style> pertama (Astro memungkinkan gaya per berkas). */
function styleBlock(text: string): string {
  const m = text.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  return m ? m[1] : "";
}

/** Kelas yang dipakai elemen yang juga membawa atribut `hidden` di markup. */
function hiddenClasses(markup: string): Set<string> {
  const out = new Set<string>();
  // Elemen dengan atribut hidden: cari class="…" pada tag yang sama.
  // `(?<![\w-])hidden(?![\w-])` mengecualikan aria-hidden & data-hidden.
  const tagRe = /<[a-zA-Z][^>]*?(?<![\w-])hidden(?![\w-])[^>]*>/g;
  for (const tag of markup.match(tagRe) ?? []) {
    const cls = tag.match(/class="([^"]*)"/);
    if (!cls) continue;
    for (const c of cls[1].split(/\s+/)) if (c) out.add(c);
  }
  return out;
}

test("kelas berpasangan atribut hidden wajib punya aturan [hidden] bila menyetel display", () => {
  assert.ok(astroFiles.length >= 20, "inventaris .astro berubah — periksa gerbang");
  const offenders: string[] = [];
  let guarded = 0;
  for (const file of astroFiles) {
    const text = readFileSync(file, "utf8");
    const style = styleBlock(text);
    if (!style) continue;
    for (const cls of hiddenClasses(text)) {
      // Cari aturan `.kelas { … display: … }`
      const rule = style.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`));
      if (!rule || !/display\s*:/.test(rule[1])) continue;
      // Basis `display: none` = netral dengan [hidden] bawaan browser, tidak
      // menimpa apa pun (mis. .tab-panel yang aktifnya lewat kelas .active).
      if (/display\s*:\s*none/.test(rule[1])) continue;
      // Wajib ada penawar: .kelas[hidden] yang menyetel display: none
      const antidote = style.match(new RegExp(`\\.${cls}\\[hidden\\]\\s*\\{([^}]*)\\}`));
      if (antidote && /display\s*:\s*none/.test(antidote[1])) {
        guarded += 1;
        continue;
      }
      offenders.push(`${rel(file)}: .${cls} menyetel display tapi tanpa .${cls}[hidden] { display: none }`);
    }
  }
  // Pola ini sudah dipakai di beberapa komponen (.btn-tertiary di
  // ChildProfileForm, .offline-banner di learn.astro) — kalau inventarisnya
  // menyusut, berarti ada berkas baru yang lolos tanpa aturan turunan.
  assert.ok(guarded >= 2, `hanya ${guarded} kelas terjaga — pola [hidden] tampaknya dihapus`);
  assert.deepEqual(offenders, [], `kelas yang menimpa [hidden]:\n${offenders.join("\n")}`);
});

test("banner offline child home tetap tersembunyi saat online (regresi temuan 2026-10-10)", () => {
  const learn = readFileSync(join(root, "src/pages/learn.astro"), "utf8");
  // Markup: atribut hidden ada sejak awal (sebelum JS berjalan).
  assert.match(
    learn,
    /<div id="offline-banner"[^>]*\bhidden\b/,
    "banner offline harus membawa atribut hidden sejak markup dirender",
  );
  // JS: status online mengembalikan hidden = true.
  assert.match(
    learn,
    /banner\.hidden\s*=\s*navigator\.onLine/,
    "JS banner harus mengikuti navigator.onLine",
  );
  // Gaya: penawar display untuk atribut hidden.
  const style = styleBlock(learn);
  const m = style.match(/\.offline-banner\[hidden\]\s*\{([^}]*)\}/);
  assert.ok(m, ".offline-banner[hidden] { display: none } wajib ada");
  assert.match(m[1], /display\s*:\s*none/, "aturan [hidden] harus menyetel display: none");
});
