import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;

test("design tokens: palette DESIGN-SYSTEM lengkap & bukan nilai acak", () => {
  const css = readFileSync(root + "src/styles/tokens.css", "utf8");
  const required = [
    "#fff9ee", // Ivory
    "#fffcf7", // Warm White
    "#174a3a", // Deep Green
    "#f5e885", // Warm Yellow
    "#b85a52", // Error Red
  ];
  for (const hex of required) {
    assert.ok(css.includes(hex), `token ${hex} hilang`);
  }
  // variabel wajib dipakai komponen
  const tokenNames = ["--sp-4", "--r-card", "--dur-tap", "--touch-min"];
  for (const n of tokenNames) {
    assert.ok(css.includes(n), `token ${n} hilang`);
  }
});

test("reduced-motion dimatikan via media query", () => {
  const css = readFileSync(root + "src/styles/tokens.css", "utf8");
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
});

test("layout memuat global.css & skip-link (a11y)", () => {
  const layout = readFileSync(root + "src/layouts/BaseLayout.astro", "utf8");
  assert.ok(layout.includes("styles/global.css"));
  assert.ok(layout.includes("skip-link"));
  assert.ok(layout.includes('lang="id"'));
  // Musik OFF by default
  assert.ok(layout.includes("MUSIC_OFF_DEFAULT"));
});

test("500.astro ada (error boundary)", () => {
  const page = readFileSync(root + "src/pages/500.astro", "utf8");
  assert.ok(page.includes("Coba Lagi"));
  // tanpa pesan error mentah
  assert.ok(!page.includes("digest"));
});
