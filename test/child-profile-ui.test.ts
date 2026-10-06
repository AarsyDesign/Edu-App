/**
 * Gerbang UI profil anak (VRD 4.1–4.6, 4.9, 4.10) — anti-slop + PRD §8.
 *
 * Memastikan formulir anak baru/mengubah hanya meminta isian yang diizinkan
 * PRD §8, memakai token desain, menampilkan status lewat teks (bukan warna
 * saja), dan tautan di dashboard benar-benar menunjuk rute yang ada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");
const exists = (p: string) => existsSync(root + p);

const form = read("src/components/ChildProfileForm.astro");
const card = read("src/components/ChildProfileCard.astro");
const dashboard = read("src/pages/parent.astro");

test("halaman buat & ubah tersedia dan memakai komponen formulir yang sama", () => {
  assert.ok(exists("src/pages/parent/profil/baru.astro"), "rute /parent/profil/baru belum ada");
  assert.ok(
    exists("src/pages/parent/profil/[id]/edit.astro"),
    "rute /parent/profil/[id]/edit belum ada",
  );

  const create = read("src/pages/parent/profil/baru.astro");
  const edit = read("src/pages/parent/profil/[id]/edit.astro");
  for (const page of [create, edit]) {
    assert.ok(page.includes("ChildProfileForm"));
    assert.ok(page.includes('mode="parent"'));
  }
  assert.ok(create.includes('mode="create"'));
  assert.ok(edit.includes('mode="edit"'));
});

test("tautan profil di dashboard menunjuk rute yang benar-benar ada", () => {
  assert.ok(dashboard.includes("/parent/profil/baru"));
  assert.ok(dashboard.includes("/parent/profil/${child.childId}/edit"));
  assert.ok(exists("src/pages/parent/profil/baru.astro"));
  assert.ok(exists("src/pages/parent/profil/[id]/edit.astro"));
});

test("halaman ubah mengunci kepemilikan di server sebelum merender", () => {
  const edit = read("src/pages/parent/profil/[id]/edit.astro");
  assert.ok(edit.includes("getChildForParent"));
  assert.ok(edit.includes('Astro.redirect("/login")'), "tanpa sesi harus ke /login");
  assert.ok(edit.includes('Astro.redirect("/parent")'), "id asing/tidak ada harus ke /parent");
  assert.ok(edit.includes("archivedAt"), "profil terarsip tidak boleh bisa diedit");
  // id tidak pernah dipercaya dari body/kueri klien (VRD 3.8)
  assert.ok(!/searchParams\.get\(["']child/.test(edit));
});

test("formulir menargetkan endpoint /api/children + fallback POST non-JS", () => {
  assert.ok(form.includes("data-endpoint={endpoint}"));
  assert.match(form, /method="post"/);
  assert.match(form, /action=\{endpoint\}/);
  assert.ok(form.includes("/api/children"), "endpoint koleksi anak wajib ada");
  assert.ok(form.includes("PATCH") && form.includes("POST"), "mode edit PATCH, mode buat POST");
  assert.ok(!/action="[^"]*\?/.test(form), "isian tidak boleh lewat query string");
});

test("hanya isian PRD §8 yang diminta (tanpa PII berlebih)", () => {
  // Wajib sesuai langkah onboarding PRD §8
  for (const name of ["nickname", "age", "avatarKey", "language", "learningGoal"]) {
    assert.ok(form.includes(`name="${name}"`), `isian ${name} hilang`);
  }
  // Usia 3/4/5/6/7 (PRD §8 langkah 4)
  assert.match(form, /const ages = \[3, 4, 5, 6, 7\]/);
  // Larangan PRD §8 "Do not request"
  assert.ok(!/type="date"/.test(form), "tanggal lahir dilarang diminta");
  assert.ok(!/type="file"/.test(form), "unggah foto dilarang");
  assert.ok(!/accept="/.test(form), "unggah berkas dilarang");
  assert.ok(
    !/name="(fullName|namaLengkap|address|alamat|phone|telepon|school|sekolah|birthDate|tanggalLahir|photo|foto)"/i.test(form),
    "isian PII di luar PRD §8 terdeteksi",
  );
  // Batas validasi konsisten dengan server (CHILD_LIMITS)
  assert.ok(form.includes("CHILD_LIMITS"));
  assert.match(form, /maxlength=\{String\(CHILD_LIMITS\.nicknameMax\)\}/);
  assert.match(form, /maxlength=\{String\(CHILD_LIMITS\.goalMax\)\}/);
  assert.match(form, /MAX_GOALS = 6/, "maksimal 6 tujuan belajar");
});

test("katalog avatar konsisten dengan kartu profil (bintang, bulan, buku, lentera)", () => {
  const formKeys = [...form.matchAll(/key:\s*"([a-z]+)",\s*label:\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .sort();
  const cardBlock = /avatarSVGs: Record<string, string> = \{([\s\S]*?)\};/.exec(card);
  assert.ok(cardBlock, "katalog avatar di ChildProfileCard tidak terbaca");
  const cardKeys = [...cardBlock[1].matchAll(/^\s*([a-z]+):\s*`/gm)].map((m) => m[1]).sort();
  assert.deepEqual(formKeys, cardKeys);
  assert.deepEqual(formKeys, ["book", "lantern", "moon", "star"]);
  // avatar bersifat opsional → ada pilihan "tanpa avatar"
  assert.ok(form.includes('value=""'));
});

test("status tidak disampaikan lewat warna saja (live region + teks)", () => {
  assert.ok(form.includes('role="status"'));
  assert.ok(form.includes("aria-live"));
  assert.ok(form.includes("Menyimpan"));
  assert.ok(form.includes('data-tone="error"'));
  assert.ok(form.includes("Coba lagi"));
  // DESIGN.md error-note / badge-success: permukaan bertint + teks gelap
  assert.match(form, /\.status\[data-tone="error"\][^{]*\{[^}]*--c-soft-peach[^}]*--c-ink/s);
  assert.match(form, /\.status\[data-tone="ok"\][^{]*\{[^}]*--c-soft-green[^}]*--c-deep-green/s);
  assert.ok(!/--c-error\b/.test(form), "jangan pakai teks merah langsung");
});

test("token desain: tanpa nilai hex hardcoded & sentuh target ≥44px", () => {
  const hexes = form.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hexes, [], `nilai warna hardcoded: ${hexes.join(", ")}`);
  assert.ok(form.includes("var(--c-deep-green)"));
  assert.ok(form.includes("var(--r-card"));
  assert.ok(form.includes("var(--sp-"));
  assert.match(form, /min-height:\s*52px/); // tombol utama
  assert.match(form, /min-height:\s*48px/); // input
  assert.ok(form.includes("var(--touch-min)")); // chip avatar
  // reduced motion dihormati lewat token durasi (bukan angka animasi sendiri)
  assert.ok(form.includes("var(--dur-tap)"));
  assert.ok(!/@keyframes/.test(form), "tanpa animasi baru di formulir");
});

test("aksi arsip di kartu memakai DELETE sungguhan + konfirmasi orang tua", () => {
  assert.ok(card.includes('data-archive'), "form arsip harus ditandai untuk skrip");
  assert.ok(card.includes('method: "DELETE"'));
  assert.ok(card.includes("window.confirm"));
  assert.ok(card.includes('role="status"'), "galat arsip butuh live region");
  assert.ok(!card.includes("_method"), "kembali ke pola _method=DELETE tanpa JS = 405");
});
