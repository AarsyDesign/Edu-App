/**
 * Gerbang UI auth (VRD 3.1–3.2 bagian klien) — anti-slop + aksesibilitas.
 * Memastikan halaman login/daftar memakai token desain, punya status non-warna,
 * dan tidak membocorkan kata sandi lewat URL tanpa JavaScript.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");

const form = read("src/components/ParentAuthForm.astro");

test("halaman /login dan /daftar memakai komponen formulir yang sama", () => {
  const login = read("src/pages/login.astro");
  const daftar = read("src/pages/daftar.astro");
  assert.ok(login.includes("ParentAuthForm"));
  assert.ok(login.includes('mode="login"'));
  assert.ok(daftar.includes("ParentAuthForm"));
  assert.ok(daftar.includes('mode="register"'));
  // mode="parent" agar gaya area orang tua (bukan mode anak)
  assert.ok(login.includes('mode="parent"'));
  assert.ok(daftar.includes('mode="parent"'));
});

test("formulir menargetkan endpoint auth yang benar + fallback POST non-JS", () => {
  assert.ok(form.includes("/api/auth/login"));
  assert.ok(form.includes("/api/auth/register"));
  // tanpa JS: POST form-urlencoded ke endpoint yang sama (kata sandi di body, bukan URL)
  assert.match(form, /method="post"/);
  assert.match(form, /action=\{endpoint\}/);
  // tidak ada GET bersisi kata sandi
  assert.ok(!/action="[^"]*\?/.test(form));
});

test("field wajib lengkap & autocomplete autentikasi yang tepat", () => {
  assert.ok(form.includes('type="email"'));
  assert.ok(form.includes('name="password"'));
  assert.match(form, /minlength="8"/);
  assert.ok(form.includes('"new-password"'));
  assert.ok(form.includes('"current-password"'));
  assert.equal((form.match(/required/g) ?? []).length >= 3, true);
  // register punya nama tampilan
  assert.ok(form.includes('name="displayName"'));
});

test("status tidak disampaikan lewat warna saja (live region + teks)", () => {
  assert.ok(form.includes('role="status"'));
  assert.ok(form.includes("aria-live"));
  // teks sibuk/galat eksplisit, bukan cuma perubahan warna
  assert.ok(form.includes("Memproses"));
  assert.ok(form.includes('data-tone="error"'));
  assert.ok(form.includes("Coba lagi"));
  // DESIGN.md `error-note`: permukaan soft-peach + teks ink (bukan teks merah
  // di atas putih) supaya kontras lolos WCAG AA
  assert.match(form, /\.status\[data-tone="error"\][^{]*\{[^}]*--c-soft-peach[^}]*--c-ink/s);
  assert.match(form, /\.status\[data-tone="ok"\][^{]*\{[^}]*--c-soft-green[^}]*--c-deep-green/s);
  // komponen tidak memakai teks error semantik (#b85a52) langsung
  assert.ok(!/--c-error\b/.test(form));
});

test("sentuh target & token desain: tanpa nilai hex hardcoded di komponen", () => {
  const hexes = form.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hexes, [], `nilai warna hardcoded: ${hexes.join(", ")}`);
  // semua nilai visual lewat var(--token)
  assert.ok(form.includes("var(--c-deep-green)"));
  assert.ok(form.includes("var(--r-card"));
  assert.ok(form.includes("var(--sp-"));
  assert.match(form, /min-height:\s*52px/); // tombol utama di atas 44px
  assert.match(form, /min-height:\s*48px/); // input di atas 44px
});
