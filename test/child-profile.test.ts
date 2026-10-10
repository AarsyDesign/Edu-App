/**
 * Profil anak (VRD Phase 4, item 4.1–4.7, 4.9–4.10) — data + endpoint.
 *
 * Menguji: validasi isian (usia 3–7, nickname, avatar non-hidup, bahasa,
 * learning goals), kepemilikan server-side (akun lain → 404 identik dengan
 * "tidak ada"), nickname aktif unik per akun, arsip yang mempertahankan
 * riwayat, serta perilaku endpoint sungguhan Astro (status, bentuk respons,
 * penolakan lintas-asal, sesi hilang).
 *
 * Proteksi sesi untuk prefix `/api/children` diuji di `route-guard.test.ts`
 * (middleware 3.5); file ini menguji handler dengan sesi yang sudah dititipkan
 * middleware, persis seperti kondisi produksi.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const db = await (async () => {
  const mod = await import("../src/lib/db/index.ts");
  return mod.getDb();
})();
const { closeDb } = await import("../src/lib/db/index.ts");
const { registerParent } = await import("../src/lib/auth/accounts.ts");
const profiles = await import("../src/lib/children/profiles.ts");
const collection = await import("../src/pages/api/children/index.ts");
const single = await import("../src/pages/api/children/[id].ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";

class FakeCookies {
  private map = new Map<string, string>();
  get(name: string): { value: string } | undefined {
    const value = this.map.get(name);
    return value === undefined ? undefined : { value };
  }
  set(name: string, value: string, _opts: Record<string, unknown>): void {
    this.map.set(name, value);
  }
  delete(name: string, _opts?: Record<string, unknown>): void {
    this.map.delete(name);
  }
}

interface FakeContext {
  request: Request;
  cookies: FakeCookies;
  locals: { parentSession?: { parentId: string; sessionId: string; expiresAt: Date } };
  params: Record<string, string | undefined>;
}

function makeContext(options: {
  parentId?: string;
  path?: string;
  method?: string;
  body?: unknown;
  rawBody?: string;
  origin?: string;
  childId?: string;
}): FakeContext {
  const method = options.method ?? (options.body !== undefined || options.rawBody !== undefined ? "POST" : "GET");
  const raw =
    options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", options.origin ?? ORIGIN);
  const request = new Request(`${ORIGIN}${options.path ?? "/api/children"}`, {
    method,
    headers,
    body: raw,
  });
  const locals: FakeContext["locals"] = {};
  if (options.parentId !== undefined) {
    locals.parentSession = {
      parentId: options.parentId,
      sessionId: "sesi-uji",
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  return {
    request,
    cookies: new FakeCookies(),
    locals,
    params: options.childId !== undefined ? { id: options.childId } : {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: FakeContext): Promise<Response> {
  return handler(ctx);
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `profil${seq}@contoh.id`,
    displayName: `Profil ${seq}`,
    password: "sand1-kuat-99",
  });
  assert.ok(reg.ok);
  if (!reg.ok) throw new Error("registrasi uji gagal");
  return reg.value.parentId;
}

function validBody(nickname = "Bintang"): Record<string, unknown> {
  return { nickname, age: 5 };
}

// ---------- 4.1–4.7 validasi isian ----------

test("4.1 buat profil: isian valid tersimpan lengkap dengan default PRD §8", async () => {
  const parentId = await makeParent();
  const result = await profiles.createChildProfile(db, parentId, {
    nickname: "  Kinasah  ",
    age: 4,
    avatarKey: "moon",
    language: "en",
    learningGoals: ["Mengenal angka", "Adab"],
  });
  assert.ok(result.ok);
  if (!result.ok) return;

  const child = result.value;
  assert.equal(child.nickname, "Kinasah", "nickname di-trim");
  assert.equal(child.age, 4);
  assert.equal(child.avatarKey, "moon");
  assert.equal(child.language, "en");
  assert.deepEqual(child.learningGoals, ["Mengenal angka", "Adab"]);
  assert.equal(child.archivedAt, null);
  assert.equal(child.parentAccountId, parentId, "4.7 kepemilikan ikut tersimpan");

  // Default saat field opsional tidak dikirim.
  const minimal = await profiles.createChildProfile(db, parentId, {
    nickname: "Minimal",
    age: 3,
  });
  assert.ok(minimal.ok);
  if (!minimal.ok) return;
  assert.equal(minimal.value.avatarKey, null);
  assert.equal(minimal.value.language, "id");
  assert.deepEqual(minimal.value.learningGoals, []);
});

test("4.1–4.6 menolak isian di luar kontrak (usia, nickname, avatar, bahasa, goals)", async () => {
  const parentId = await makeParent();
  const invalid: Array<[string, Record<string, unknown>]> = [
    ["usia 2 (di bawah rentang)", { nickname: "A", age: 2 }],
    ["usia 8 (di atas rentang)", { nickname: "A", age: 8 }],
    ["usia pecahan", { nickname: "A", age: 5.5 }],
    ["usia berupa teks", { nickname: "A", age: "5" }],
    ["usia hilang", { nickname: "A" }],
    ["nickname hilang", { age: 5 }],
    ["nickname kosong", { nickname: "   ", age: 5 }],
    ["nickname terlalu panjang", { nickname: "x".repeat(41), age: 5 }],
    ["avatar bukan kunci teknis", { nickname: "A", age: 5, avatarKey: "Moon Emoji" }],
    ["avatar di luar katalog (kunci teknis sah)", { nickname: "A", age: 5, avatarKey: "rocket" }],
    ["avatar di luar katalog (motif hewan)", { nickname: "A", age: 5, avatarKey: "kucing" }],
    ["avatar kosong", { nickname: "A", age: 5, avatarKey: "" }],
    ["bahasa salah bentuk", { nickname: "A", age: 5, language: "ID" }],
    ["goals bukan array", { nickname: "A", age: 5, learningGoals: "angka" }],
    ["goals berisi angka", { nickname: "A", age: 5, learningGoals: [1] }],
    ["goals kosong-butir", { nickname: "A", age: 5, learningGoals: ["  "] }],
    ["terlalu banyak goals", { nickname: "A", age: 5, learningGoals: ["a","b","c","d","e","f","g"] }],
    ["kunci asing", { nickname: "A", age: 5, school: "SDIT" }],
  ];
  for (const [label, body] of invalid) {
    const result = await profiles.createChildProfile(db, parentId, body);
    assert.equal(result.ok, false, `${label} harus ditolak`);
    if (!result.ok) {
      assert.equal(result.code, "INVALID_INPUT", label);
      assert.ok(result.message.length > 0);
    }
  }
  // Tidak ada satu pun profil tersimpan dari body yang ditolak.
  const list = await profiles.listChildrenForParent(db, parentId);
  assert.equal(list.length, 0);
});

test("OQ 15: seluruh kunci katalog avatar diterima; modul bersama = validasi server", async () => {
  const { AVATAR_KEYS, isAvatarKey } = await import("../src/lib/children/avatars.ts");
  assert.deepEqual([...AVATAR_KEYS].sort(), ["book", "lantern", "moon", "star"]);
  for (const key of AVATAR_KEYS) assert.ok(isAvatarKey(key), `${key} harus di katalog`);
  for (const key of ["rocket", "kucing", "STAR", "star2"]) {
    assert.equal(isAvatarKey(key), false, `${key} bukan kunci katalog`);
  }

  // Keempat kunci katalog benar-benar tersimpan lewat jalur data yang sama
  // yang dipakai endpoint (parseChildInput → createChildProfile).
  const parentId = await makeParent();
  for (const [i, key] of AVATAR_KEYS.entries()) {
    const result = await profiles.createChildProfile(db, parentId, {
      nickname: `Motif ${i}`,
      age: 4,
      avatarKey: key,
    });
    assert.ok(result.ok, `kunci katalog ${key} harus diterima`);
    if (result.ok) assert.equal(result.value.avatarKey, key);
  }
});

test("nickname aktif unik per akun — tabrakan beda kapital/spasi ditolak", async () => {
  const parentId = await makeParent();
  const first = await profiles.createChildProfile(db, parentId, validBody("Bintang"));
  assert.ok(first.ok);

  for (const variant of ["bintang", " Bintang ", "BINTANG"]) {
    const dup = await profiles.createChildProfile(db, parentId, validBody(variant));
    assert.equal(dup.ok, false, `nickname ${JSON.stringify(variant)} harus tabrakan`);
    if (!dup.ok) assert.equal(dup.code, "NICKNAME_TAKEN");
  }

  // Nickname yang sama di akun lain tetap boleh.
  const otherParent = await makeParent();
  const theirs = await profiles.createChildProfile(db, otherParent, validBody("Bintang"));
  assert.ok(theirs.ok);
});

// ---------- daftar (bahan child switcher 4.8) ----------

test("listChildrenForParent: hanya profil aktif milik sendiri, urut pembuatan", async () => {
  const parentId = await makeParent();
  const otherParent = await makeParent();

  const a = await profiles.createChildProfile(db, parentId, validBody("Anak A"));
  const b = await profiles.createChildProfile(db, parentId, validBody("Anak B"));
  await profiles.createChildProfile(db, otherParent, validBody("Anak Lain"));
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  await profiles.archiveChildProfile(db, b.value.childId, parentId);

  const mine = await profiles.listChildrenForParent(db, parentId);
  assert.deepEqual(
    mine.map((c) => c.nickname),
    ["Anak A"],
    "profil terarsip tidak ikut daftar aktif",
  );
  const theirs = await profiles.listChildrenForParent(db, otherParent);
  assert.deepEqual(theirs.map((c) => c.nickname), ["Anak Lain"]);
});

// ---------- 4.9 edit profil ----------

test("4.9 update: sebagian field saja boleh, sisanya tidak berubah", async () => {
  const parentId = await makeParent();
  const created = await profiles.createChildProfile(db, parentId, {
    nickname: "Lentera",
    age: 6,
    avatarKey: "star",
    language: "id",
    learningGoals: ["Bentuk"],
  });
  assert.ok(created.ok);
  if (!created.ok) return;

  const updated = await profiles.updateChildProfile(db, created.value.childId, parentId, {
    age: 7,
    learningGoals: ["Bentuk", "Warna"],
  });
  assert.ok(updated.ok);
  if (!updated.ok) return;
  assert.equal(updated.value.age, 7);
  assert.deepEqual(updated.value.learningGoals, ["Bentuk", "Warna"]);
  assert.equal(updated.value.nickname, "Lentera");
  assert.equal(updated.value.avatarKey, "star");

  // avatarKey null = mengosongkan pilihan (bukan "tidak dikirim").
  const cleared = await profiles.updateChildProfile(db, created.value.childId, parentId, {
    avatarKey: null,
  });
  assert.ok(cleared.ok);
  if (!cleared.ok) return;
  assert.equal(cleared.value.avatarKey, null);
});

test("4.9 update menolak patch kosong / tak valid", async () => {
  const parentId = await makeParent();
  const created = await profiles.createChildProfile(db, parentId, validBody("Patch"));
  assert.ok(created.ok);
  if (!created.ok) return;

  for (const body of [{}, { age: 9 }, { nickname: "" }, { unknown: 1 }]) {
    const result = await profiles.updateChildProfile(
      db,
      created.value.childId,
      parentId,
      body,
    );
    assert.equal(result.ok, false, JSON.stringify(body));
    if (!result.ok) assert.equal(result.code, "INVALID_INPUT");
  }

  // Tabrakan nickname saat edit juga dilaporkan, bukan error.
  await profiles.createChildProfile(db, parentId, validBody("Sudah Ada"));
  const clash = await profiles.updateChildProfile(db, created.value.childId, parentId, {
    nickname: "sudah ada",
  });
  assert.equal(clash.ok, false);
  if (!clash.ok) assert.equal(clash.code, "NICKNAME_TAKEN");
});

test("4.7/3.7 update milik orang lain = NOT_FOUND, identik dengan id yang tidak ada", async () => {
  const owner = await makeParent();
  const other = await makeParent();
  const created = await profiles.createChildProfile(db, owner, validBody("Milik Orang Lain"));
  assert.ok(created.ok);
  if (!created.ok) return;

  const foreign = await profiles.updateChildProfile(
    db,
    created.value.childId,
    other,
    { nickname: "Dibajak" },
  );
  const missing = await profiles.updateChildProfile(
    db,
    "00000000-0000-4000-8000-000000000000",
    other,
    { nickname: "Dibajak" },
  );
  const malformed = await profiles.updateChildProfile(db, "bukan-uuid", other, {
    nickname: "Dibajak",
  });
  assert.equal(foreign.ok, false);
  assert.equal(missing.ok, false);
  assert.equal(malformed.ok, false);
  if (foreign.ok || missing.ok || malformed.ok) return;
  assert.equal(foreign.code, "NOT_FOUND");
  assert.equal(missing.code, "NOT_FOUND");
  assert.equal(malformed.code, "NOT_FOUND");
  assert.equal(foreign.message, missing.message);

  // Profil korban tidak berubah sama sekali.
  const list = await profiles.listChildrenForParent(db, owner);
  assert.equal(list[0]?.nickname, "Milik Orang Lain");
});

// ---------- 4.10 arsip / retensi ----------

test("4.10 arsip menyembunyikan profil tetapi mempertahankan baris riwayat", async () => {
  const parentId = await makeParent();
  const created = await profiles.createChildProfile(db, parentId, validBody("Arsip Ini"));
  assert.ok(created.ok);
  if (!created.ok) return;

  const archived = await profiles.archiveChildProfile(db, created.value.childId, parentId);
  assert.ok(archived.ok);
  if (!archived.ok) return;
  assert.ok(archived.value.archivedAt !== null, "archived_at terisi");

  const row = await db.query<{ archived_at: Date | null }>(
    "SELECT archived_at FROM child_profile WHERE id = $1::uuid",
    [created.value.childId],
  );
  assert.equal(row.rows.length, 1, "baris profil tetap ada (tanpa hard delete)");
  assert.ok(row.rows[0].archived_at !== null);

  // Arsip ulang = idempoten, bukan galat.
  const again = await profiles.archiveChildProfile(db, created.value.childId, parentId);
  assert.ok(again.ok);

  // Nickname dibebaskan untuk profil aktif baru.
  const reuse = await profiles.createChildProfile(db, parentId, validBody("Arsip Ini"));
  assert.ok(reuse.ok);
});

test("4.10 arsip milik orang lain = NOT_FOUND", async () => {
  const owner = await makeParent();
  const other = await makeParent();
  const created = await profiles.createChildProfile(db, owner, validBody("Jangan Diarsip"));
  assert.ok(created.ok);
  if (!created.ok) return;

  const foreign = await profiles.archiveChildProfile(db, created.value.childId, other);
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, "NOT_FOUND");

  const stillActive = await profiles.listChildrenForParent(db, owner);
  assert.equal(stillActive.length, 1, "profil pemilik tidak tersentuh");
});

// ---------- endpoint ----------

test("POST /api/children → 201, bentuk respons tanpa parentAccountId", async () => {
  const parentId = await makeParent();
  const res = await call(
    collection.POST,
    makeContext({ parentId, method: "POST", body: { nickname: "Endpo Anak", age: 4 } }),
  );
  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    ok: boolean;
    child: Record<string, unknown>;
  };
  assert.equal(body.ok, true);
  assert.equal(body.child.nickname, "Endpo Anak");
  assert.equal(body.child.age, 4);
  assert.equal("parentAccountId" in body.child, false, "id akun tidak boleh keluar");
  assert.equal("parent_account_id" in body.child, false);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const list = await call(collection.GET, makeContext({ parentId }));
  assert.equal(list.status, 200);
  const listed = (await list.json()) as { children: Array<Record<string, unknown>> };
  assert.equal(listed.children.length, 1);
  assert.equal(listed.children[0]?.nickname, "Endpo Anak");
});

test("POST /api/children → 400 isian salah, 409 nickname duplikat, 400 body rusak", async () => {
  const parentId = await makeParent();
  const bad = await call(
    collection.POST,
    makeContext({ parentId, method: "POST", body: { nickname: "X", age: 99 } }),
  );
  assert.equal(bad.status, 400);
  const badBody = (await bad.json()) as { error: string };
  assert.equal(badBody.error, "INVALID_INPUT");

  await call(
    collection.POST,
    makeContext({ parentId, method: "POST", body: { nickname: "Kembar", age: 3 } }),
  );
  const dup = await call(
    collection.POST,
    makeContext({ parentId, method: "POST", body: { nickname: "kembar", age: 3 } }),
  );
  assert.equal(dup.status, 409);
  assert.equal(((await dup.json()) as { error: string }).error, "NICKNAME_TAKEN");

  const malformed = await call(
    collection.POST,
    makeContext({ parentId, method: "POST", rawBody: "{bukan-json" }),
  );
  assert.equal(malformed.status, 400);

  const huge = await call(
    collection.POST,
    makeContext({ parentId, method: "POST", rawBody: JSON.stringify({ nickname: "x".repeat(9000), age: 5 }) }),
  );
  assert.equal(huge.status, 400, "body > 8 KB ditolak");
});

test("endpoint tanpa sesi di konteks → 401 (tidak ada fallback ke body/kueri)", async () => {
  const withoutSession = makeContext({ method: "POST", body: validBody() });
  const get = await call(collection.GET, makeContext({}));
  const post = await call(collection.POST, withoutSession);
  const patch = await call(single.PATCH, makeContext({ method: "PATCH", body: { age: 5 } }));
  const del = await call(single.DELETE, makeContext({ method: "DELETE", childId: "x" }));
  for (const [label, res] of [
    ["GET", get],
    ["POST", post],
    ["PATCH", patch],
    ["DELETE", del],
  ] as const) {
    assert.equal(res.status, 401, label);
    assert.equal(((await res.json()) as { error: string }).error, "UNAUTHENTICATED");
  }
});

test("endpoint menolak permintaan lintas-asal (CSRF lapis kedua)", async () => {
  const parentId = await makeParent();
  for (const res of [
    await call(
      collection.POST,
      makeContext({ parentId, method: "POST", body: validBody(), origin: "https://contoh-asing.id" }),
    ),
    await call(
      single.PATCH,
      makeContext({ parentId, method: "PATCH", body: { age: 5 }, childId: "bukan-uuid", origin: "https://contoh-asing.id" }),
    ),
    await call(
      single.DELETE,
      makeContext({ parentId, method: "DELETE", childId: "bukan-uuid", origin: "https://contoh-asing.id" }),
    ),
  ]) {
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as { error: string }).error, "FORBIDDEN");
  }
});

test("PATCH & DELETE /api/children/:id — sukses, 404 identik, arsip idempoten", async () => {
  const owner = await makeParent();
  const other = await makeParent();
  const created = await call(
    collection.POST,
    makeContext({ parentId: owner, method: "POST", body: validBody("Endpoint Edit") }),
  );
  assert.equal(created.status, 201);
  const childId = ((await created.json()) as { child: { childId: string } }).child.childId;

  const patched = await call(
    single.PATCH,
    makeContext({ parentId: owner, method: "PATCH", childId, body: { age: 7, nickname: "Endpoint Edit Baru" } }),
  );
  assert.equal(patched.status, 200);
  const patchedBody = (await patched.json()) as { child: { age: number; nickname: string } };
  assert.equal(patchedBody.child.age, 7);
  assert.equal(patchedBody.child.nickname, "Endpoint Edit Baru");

  // Milik orang lain & id tidak ada → 404 dengan badan identik.
  const foreign = await call(
    single.PATCH,
    makeContext({ parentId: other, method: "PATCH", childId, body: { nickname: "Bajak" } }),
  );
  const missing = await call(
    single.PATCH,
    makeContext({ parentId: other, method: "PATCH", childId: "00000000-0000-4000-8000-000000000000", body: { nickname: "Bajak" } }),
  );
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await foreign.json(), await missing.json());

  const archived = await call(
    single.DELETE,
    makeContext({ parentId: owner, method: "DELETE", childId }),
  );
  assert.equal(archived.status, 200);
  const archivedBody = (await archived.json()) as { child: { archivedAt: string | null } };
  assert.ok(archivedBody.child.archivedAt !== null);

  const repeat = await call(
    single.DELETE,
    makeContext({ parentId: owner, method: "DELETE", childId }),
  );
  assert.equal(repeat.status, 200, "arsip idempoten");

  const foreignDelete = await call(
    single.DELETE,
    makeContext({ parentId: other, method: "DELETE", childId }),
  );
  assert.equal(foreignDelete.status, 404);

  const afterArchive = await call(collection.GET, makeContext({ parentId: owner }));
  const listed = (await afterArchive.json()) as { children: unknown[] };
  assert.equal(listed.children.length, 0, "profil terarsip hilang dari daftar aktif");
});
