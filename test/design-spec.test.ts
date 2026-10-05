import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const designMd = readFileSync(root + "DESIGN.md", "utf8");
const tokensCss = readFileSync(root + "src/styles/tokens.css", "utf8");

test("DESIGN.md ada, punya front matter token (spec Google DESIGN.md)", () => {
  assert.ok(designMd.startsWith("---\n"), "wajib dibuka front matter ---");
  assert.match(designMd, /^version:\s*alpha/m, "spec version harus alpha");
  assert.match(designMd, /^name:\s*\S+/m, "wajib ada name:");
  assert.match(designMd, /^colors:/m, "wajib ada colors:");
  assert.match(designMd, /^typography:/m, "wajib ada typography:");
  // Bagian body wajib memuat checklist anti-slop (bukan cuma token)
  assert.match(designMd, /## Do's and Don'ts/, "wajib ada bagian Do's and Don'ts");
  assert.match(designMd, /anti-slop/i, "wajib menyebut anti-slop checklist");
});

test("DESIGN.md dan tokens.css konsisten (sumber nilai visual satu arah)", () => {
  const hexes = [...designMd.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) =>
    m[1].toLowerCase(),
  );
  assert.ok(hexes.length >= 10, `minimal 10 warna, dapat ${hexes.length}`);
  const cssLower = tokensCss.toLowerCase();
  const missing = hexes.filter((h) => !cssLower.includes(h));
  assert.deepEqual(missing, [], `hex di DESIGN.md tak ada di tokens.css: ${missing}`);
});

test("Gerbang anti-slop: reduced-motion, touch target, durasi dalam budget 120-700ms", () => {
  assert.match(tokensCss, /prefers-reduced-motion:\s*reduce/, "wajib reduced motion");
  assert.match(tokensCss, /--touch-min:\s*44px/, "touch target min 44px");
  const durs = [...tokensCss.matchAll(/--dur-[a-z]+:\s*(\d+)ms/g)].map((m) =>
    Number(m[1]),
  );
  assert.ok(durs.length >= 4, "minimal 4 token durasi");
  for (const d of durs) {
    // 0ms hanya sah sebagai override prefers-reduced-motion (DESIGN-SYSTEM §7)
    if (d === 0) continue;
    assert.ok(d >= 120 && d <= 700, `${d}ms di luar budget 120-700ms`);
  }
  assert.ok(durs.some((d) => d === 0), "wajib ada override 0ms saat reduced motion");
});
