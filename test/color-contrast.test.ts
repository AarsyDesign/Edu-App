import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * Gerbang kontras WCAG AA (anti-slop: "Accessible by Design", ≥4.5:1).
 *
 * OQ 10 (docs/IMPLEMENTATION-AUDIT.md): `--c-muted-ink` lama #6C776F hanya
 * 4,45:1 di atas ivory, dan lebih rendah lagi di atas permukaan bertint —
 * teks petunjuk (`.feedback-hint`) di layar aktivitas anak duduk di atas
 * soft-green (benar) dan soft-peach (belum tepat), keduanya di bawah 4,5:1.
 * Token digelapkan dan seluruh kombinasi nyata dikunci di sini supaya tidak
 * kembali melorot diam-diam.
 */

const root = new URL("../", import.meta.url).pathname;
const tokensCss = readFileSync(root + "src/styles/tokens.css", "utf8");
const designMd = readFileSync(root + "DESIGN.md", "utf8");

function token(name: string): string {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} tidak ditemukan di tokens.css`);
  return m[1];
}

function luminance(hex: string): number {
  const n = hex.slice(1);
  const channels = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = [
  "c-ivory",
  "c-warm-white",
  "c-soft-green",
  "c-soft-peach",
] as const;

test("muted-ink lolos WCAG AA (≥4.5:1) di semua permukaan tempat dipakai", () => {
  const muted = token("c-muted-ink");
  for (const surface of SURFACES) {
    const bg = token(surface);
    const ratio = contrast(muted, bg);
    assert.ok(
      ratio >= 4.5,
      `--c-muted-ink ${muted} di atas ${surface} ${bg} = ${ratio.toFixed(2)}:1 (< 4,5:1)`,
    );
  }
});

test("teks utama (ink) lolos WCAG AA di ivory & warm-white", () => {
  const ink = token("c-ink");
  for (const surface of ["c-ivory", "c-warm-white"]) {
    const ratio = contrast(ink, token(surface));
    assert.ok(ratio >= 4.5, `--c-ink di atas ${surface} = ${ratio.toFixed(2)}:1`);
  }
});

test("DESIGN.md menyatakan nilai muted-ink yang sama seperti tokens.css (mirror)", () => {
  const m = designMd.match(/muted-ink:\s*"(#[0-9A-Fa-f]{6})"/);
  assert.ok(m, "DESIGN.md tidak memuat colors.muted-ink");
  assert.equal(
    m[1].toLowerCase(),
    token("c-muted-ink").toLowerCase(),
    "DESIGN.md dan tokens.css berbeda untuk muted-ink",
  );
});

test("kombinasi lama #6C776F dipastikan sudah tidak dipakai", () => {
  const old = "#6c776f";
  assert.ok(!tokensCss.toLowerCase().includes(old), "tokens.css masih memuat nilai lama");
  assert.ok(
    !designMd.toLowerCase().includes(old),
    "DESIGN.md masih memuat nilai lama di tempat lain",
  );
});

// ---------------------------------------------------------------------------
// OQ 30 — banner offline child home: latar --c-warning + teks --c-warm-white
// = 2,91:1 (teks ink di atas warning pun hanya 4,43:1). DESIGN.md membatasi
// warning untuk indikator status, bukan latar teks → permukaan tint
// soft-peach + teks ink (pola error-note).
// ---------------------------------------------------------------------------

test("banner offline child home memakai permukaan tint soft-peach + teks ink (bukan latar warning)", () => {
  const learn = readFileSync(root + "src/pages/learn.astro", "utf8");
  const m = learn.match(/\.offline-banner\s*\{([^}]*)\}/);
  assert.ok(m, "blok gaya .offline-banner tidak ditemukan di learn.astro");
  const body = m[1];
  assert.match(
    body,
    /background:\s*var\(--c-soft-peach\)/,
    "latar .offline-banner harus --c-soft-peach",
  );
  assert.match(body, /color:\s*var\(--c-ink\)/, "teks .offline-banner harus --c-ink");
  assert.ok(
    !/background(?:-color)?:\s*var\(--c-warning\)/.test(body),
    ".offline-banner masih memakai latar --c-warning (2,91:1 dengan teks warm-white)",
  );
  const ratio = contrast(token("c-ink"), token("c-soft-peach"));
  assert.ok(ratio >= 4.5, `teks ink di atas soft-peach = ${ratio.toFixed(2)}:1`);
});

test("gerbang: semua pasangan background+color token eksplisit di src/ lolos WCAG AA", () => {
  const srcDir = root + "src";
  const files = readdirSync(srcDir, { recursive: true })
    .map((f) => String(f))
    .filter((f) => /\.(astro|css|ts)$/.test(f));

  const tok: Record<string, string> = {};
  for (const m of tokensCss.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tok[m[1]] = m[2];
  }

  const failures: string[] = [];
  let pairs = 0;
  for (const f of files) {
    // Komentar dibuang dulu supaya catatan (mis. "latar --c-warning …")
    // tidak terbaca sebagai deklarasi gaya.
    const src = readFileSync(`${srcDir}/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim().split("\n").pop()!.trim();
      const body = rule[2];
      const bg = body.match(/(?:^|[^-\w])background(?:-color)?:\s*var\(--([a-z0-9-]+)\)/);
      const fg = body.match(/(?:^|[^-\w])color:\s*var\(--([a-z0-9-]+)\)/);
      if (!bg || !fg || !tok[bg[1]] || !tok[fg[1]]) continue;
      pairs += 1;
      const ratio = contrast(tok[bg[1]], tok[fg[1]]);
      if (ratio < 4.5) {
        failures.push(
          `${f} :: ${selector.slice(0, 50)} → --${fg[1]} di atas --${bg[1]} = ${ratio.toFixed(2)}:1`,
        );
      }
    }
  }

  // Gerbang yang tidak menemukan apa pun = gerbang rusak, bukan gerbang lolos.
  assert.ok(pairs >= 50, `hanya ${pairs} pasangan terdeteksi — pola pemindaian berubah?`);
  assert.deepEqual(failures, [], `pasangan di bawah 4,5:1:\n${failures.join("\n")}`);
});
