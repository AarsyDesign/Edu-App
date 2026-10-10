/**
 * Escaping konten di perender layar anak — temuan QA E2E eksploratif desktop
 * (2026-10-10). Sebelumnya `escapeHtml()` di `renderer.ts` adalah fungsi
 * no-op (mengganti `<` dengan `<`, `&` dengan `&`), jadi prompt/label/id
 * dari konten reviewer maupun draf AI masuk ke HTML layar anak tanpa
 * dinetralkan. Perbaikan: escaping betulan + `jsonForScript()` untuk data
 * yang disuntik ke <script type="module"> (pola `configJson` halaman aktivitas).
 *
 * Sifat tes: payload hostil disusun langsung ke `renderActivity` (tanpa
 * melewati validator) — perender wajib gagal aman juga pada jalur itu
 * (defense in depth), bukan hanya saat data sudah divalidasi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityTestFixtures,
  type ActivityType,
  type ActivityRenderInput,
} from "../src/lib/activity/domain.ts";
import { renderActivity } from "../src/lib/activity/renderer.ts";

const TYPES = Object.keys(activityTestFixtures) as ActivityType[];

function renderWith(type: ActivityType, patch: Partial<Record<string, unknown>>, prompt: string): string {
  const data = { ...(activityTestFixtures[type] as object), ...patch } as unknown as ActivityRenderInput["data"];
  const input: ActivityRenderInput = {
    activityId: "act-escape-1",
    type,
    prompt,
    data,
    childAge: 5,
    audioEnabled: false,
    reducedMotion: false,
  };
  return renderActivity(input);
}

test("prompt dan teks konten di-escape untuk kedelapan tipe (fungsi escape bukan no-op)", () => {
  for (const type of TYPES) {
    const html = renderWith(type, {}, 'Pertanyaan <img src=x onerror="alert(1)"> & "tanda kutip"');
    assert.ok(html.includes("&lt;img"), `${type}: tag di prompt dinetralkan`);
    assert.ok(html.includes("&amp;"), `${type}: ampersand dinetralkan`);
    assert.ok(!html.includes("<img src=x"), `${type}: tanpa tag mentah dari prompt`);
    assert.ok(
      !/<h1 class="prompt-text">[^<]*<img/.test(html),
      `${type}: prompt tidak pernah memuat tag mentah`,
    );
  }
});

test("label opsi di-escape: kutip tidak memutus atribut data-option-id", () => {
  const html = renderWith(
    "TAP_ANSWER",
    { items: [
      { id: 'opt-1" aria-hidden="false', label: 'Apel</button><script>alert(1)</script>', isCorrect: true },
      { id: "opt-2", label: "Pisang", isCorrect: false },
    ] },
    "Mana?",
  );
  // Atribut tetap utuh: nilai berakhir di dalam tanda kutip atribut.
  assert.ok(!/data-option-id="[^"]*"\s+aria-hidden/.test(html), "kutip id tidak membuka atribut baru");
  assert.ok(html.includes("opt-1&quot;"), "kutip id di-escape di atribut");
  assert.ok(!html.includes("<script>alert(1)</script>"), "label tidak menyuntik skrip");
});

test("id MATCH/SEQUENCE di-escape di atribut data-id", () => {
  const hostile = 'x"><iframe src=//evil></iframe>';
  const match = renderWith(
    "MATCH",
    { left: [{ id: hostile, label: "kiri" }, { id: "l2", label: "dua" }],
      right: [{ id: "r1", label: "satu" }, { id: "r2", label: "dua" }],
      correctPairs: [{ leftId: hostile, rightId: "r1" }] },
    "Pasangkan",
  );
  assert.ok(!match.includes("<iframe"), "MATCH: id tidak menyuntik elemen");
  assert.ok(match.includes("&lt;iframe") || match.includes("&quot;&gt;"), "MATCH: id dinetralkan di atribut");

  const seq = renderWith(
    "SEQUENCE",
    { items: [
      { id: hostile, label: "satu", correctPosition: 0 },
      { id: "i2", label: "dua", correctPosition: 1 },
    ] },
    "Susun",
  );
  assert.ok(!seq.includes("<iframe"), "SEQUENCE: id tidak menyuntik elemen");
});

test("payload <script> module aman: id berisi </script> tidak keluar dari blok skrip", () => {
  const breakout = '</script><script>alert("keta")</script>';
  const html = renderWith(
    "TAP_ANSWER",
    { items: [
      { id: breakout, label: "Satu", isCorrect: true },
      { id: "opt-2", label: "Dua", isCorrect: false },
    ] },
    "Pilih",
  );
  const closers = html.match(/<\/script>/g) ?? [];
  assert.equal(closers.length, 1, "hanya penutup blok skrip module yang sah");
  assert.ok(html.includes("\\u003c"), "karakter < dalam JSON data ditetralkan");
  assert.ok(!html.includes("<script>alert"), "tanpa skrip suntikan dari id");
});

test("data hostil TIDAK mengubah penilaian server (id & label tetap dipakai apa adanya)", () => {
  // Id aneh tetap identik di markup (setelah di-escape) sehingga runtime klien
  // masih bisa mencocokkan pilihan anak dengan data server.
  const weird = 'opt "ber-kutip"';
  const html = renderWith(
    "TAP_ANSWER",
    { items: [
      { id: weird, label: "A", isCorrect: true },
      { id: "opt-2", label: "B", isCorrect: false },
    ] },
    "Pilih",
  );
  assert.ok(html.includes("opt &quot;ber-kutip&quot;"), "id tampil ter-escape di atribut");
  assert.ok(html.includes("opt \\u0022ber-kutip\\u0022") || html.includes('\\"ber-kutip\\"'), "id tetap ada di JSON skrip");
});
