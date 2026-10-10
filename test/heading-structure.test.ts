/**
 * Struktur judul layar aktivitas anak — temuan QA E2E eksploratif desktop
 * (2026-10-10, VRD 17.1/17.13 + QA-ACCEPTANCE "desktop responsive fallback").
 *
 * Temuan: layar aktivitas (jalur anak maupun pratinjau reviewer) tidak punya
 * satu pun heading — prompt memakai <p>, padahal cabang gagal "Aktivitas Belum
 * Siap" di halaman yang sama sudah memakai <h1>. Pembaca layar kehilangan
 * titik masuk navigasi di layar yang paling sering dipakai anak. Prompt kini
 * satu-satunya <h1 class="prompt-text">; tampilannya tidak berubah karena
 * .prompt-text sudah menetapkan font/ukuran/margin lewat token, sehingga gaya
 * bawaan <h1> tidak pernah bocor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  activityTestFixtures,
  type ActivityType,
  type ActivityRenderInput,
} from "../src/lib/activity/domain.ts";
import { renderActivity } from "../src/lib/activity/renderer.ts";

const TYPES = Object.keys(activityTestFixtures) as ActivityType[];

function renderFor(type: ActivityType, prompt = "Mana yang berwarna merah?"): string {
  const input: ActivityRenderInput = {
    activityId: "act-heading-1",
    type,
    prompt,
    data: activityTestFixtures[type],
    childAge: 5,
    audioEnabled: false,
    reducedMotion: false,
  };
  return renderActivity(input);
}

test("layar aktivitas: prompt adalah satu-satunya h1 untuk kedelapan tipe", () => {
  assert.ok(TYPES.length >= 8, "fixture tipe aktivitas lengkap");
  for (const type of TYPES) {
    const html = renderFor(type);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    assert.equal(h1s.length, 1, `${type}: jumlah h1 harus tepat 1`);
    assert.ok(html.includes('<h1 class="prompt-text">'), `${type}: h1 prompt-text ada`);
    assert.ok(
      !html.includes('<p class="prompt-text"'),
      `${type}: paragraf prompt lama tidak boleh kembali`,
    );
    const h23 = html.match(/<h[23][\s>]/g) ?? [];
    assert.equal(h23.length, 0, `${type}: tidak ada h2/h3 yang mendahului hierarki`);
  }
});

test("layar aktivitas: isi h1 = prompt ter-escape (markup konten tidak lolos)", () => {
  const html = renderFor("TAP_ANSWER", "Cari <b>ampersand & satu</b>");
  const m = html.match(/<h1 class="prompt-text">([^<]*)<\/h1>/);
  assert.ok(m, "h1 memuat teks prompt");
  assert.ok(m[1].includes("&lt;b&gt;"), "tag di prompt di-escape");
  assert.ok(!m[1].includes("<b>"), "tanpa tag mentah");
});

test("gaya bawaan h1 tidak bocor: .prompt-text menetapkan properti inti lewat token", async () => {
  const css = await readFile(new URL("../src/styles/activity.css", import.meta.url), "utf8");
  const block = css.match(/\.prompt-text\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(block.length > 0, "blok .prompt-text ada di activity.css");
  for (const prop of ["font-size", "font-weight", "line-height", "color", "margin"]) {
    assert.ok(new RegExp(`${prop}\\s*:`).test(block), `.prompt-text menetapkan ${prop}`);
  }
  assert.ok(/margin:\s*0\s*;/.test(block), "margin nol menetralkan margin bawaan heading");
  assert.ok(/var\(--/.test(block), "nilainya lewat token, bukan literal");
});
