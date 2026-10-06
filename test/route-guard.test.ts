/**
 * Gerbang rute & kepemilikan (VRD 3.5–3.7).
 *
 * Menguji: daftar rute terlindungi, keputusan gerbang (alih / 401 / izin),
 * pembersihan cookie sesi yang tidak sah, perilaku middleware sungguhan, dan
 * kepemilikan profil anak di server (akun lain selalu `null`).
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
const { createSession, SESSION_COOKIE } = await import("../src/lib/auth/session.ts");
const {
  isProtectedPath,
  guardRequest,
  getChildForParent,
} = await import("../src/lib/auth/guard.ts");
const middleware = await import("../src/middleware.ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";

class MemoryCookies {
  private map = new Map<string, string>();
  deleted: string[] = [];

  get(name: string): { value: string } | undefined {
    const value = this.map.get(name);
    return value === undefined ? undefined : { value };
  }
  set(name: string, value: string, _opts: Record<string, unknown>): void {
    this.map.set(name, value);
  }
  delete(name: string, _opts?: Record<string, unknown>): void {
    this.map.delete(name);
    this.deleted.push(name);
  }
  put(name: string, value: string): void {
    this.map.set(name, value);
  }
}

function req(path: string): Request {
  return new Request(ORIGIN + path);
}

// ---------- rute terlindungi (3.5) ----------

test("isProtectedPath: rute anak & orang tua terlindungi, sisanya tidak", () => {
  assert.equal(isProtectedPath("/parent"), true);
  assert.equal(isProtectedPath("/parent/"), true);
  assert.equal(isProtectedPath("/parent?x=1"), true);
  assert.equal(isProtectedPath("/api/parent/children"), true);
  assert.equal(isProtectedPath("/api/children/123"), true);

  // Child home & turunannya membawa data anak → wajib sesi orang tua;
  // kepemilikan `?child=` tetap dicek di dalam halaman (VRD 3.7).
  assert.equal(isProtectedPath("/learn"), true);
  assert.equal(isProtectedPath("/learn?child=123"), true);
  assert.equal(isProtectedPath("/learn/area/numbers"), true);
  assert.equal(isProtectedPath("/learn/aktivitas/abc"), true);
  assert.equal(isProtectedPath("/api/activity/attempt"), true);
  assert.equal(isProtectedPath("/api/session/start"), true);

  // batas segment: prefiks bukan potongan kata
  assert.equal(isProtectedPath("/parents"), false);
  assert.equal(isProtectedPath("/parentx/1"), false);
  assert.equal(isProtectedPath("/"), false);
  assert.equal(isProtectedPath("/login"), false);
  assert.equal(isProtectedPath("/daftar"), false);
  assert.equal(isProtectedPath("/api/auth/login"), false);
  assert.equal(isProtectedPath("/api/auth/session"), false);
});

// ---------- gerbang sesi ----------

test("guardRequest: tanpa cookie → alihkan halaman ke /login (303)", async () => {
  const cookies = new MemoryCookies();
  const result = await guardRequest(db, cookies, req("/parent"));
  assert.equal(result.allowed, false);
  if (result.allowed) return;
  assert.equal(result.response.status, 303);
  assert.equal(result.response.headers.get("location"), "/login");
  assert.equal(result.response.headers.get("cache-control"), "no-store");
});

test("guardRequest: tanpa sesi di endpoint → 401 JSON aman", async () => {
  const cookies = new MemoryCookies();
  const result = await guardRequest(db, cookies, req("/api/parent/children"));
  assert.equal(result.allowed, false);
  if (result.allowed) return;
  assert.equal(result.response.status, 401);
  assert.match(
    result.response.headers.get("content-type") ?? "",
    /application\/json/,
  );
  const body = (await result.response.json()) as { error: string; message: string };
  assert.equal(body.error, "UNAUTHENTICATED");
  // pesan generik, tanpa detail internal
  assert.ok(body.message.length > 0);
  assert.equal(/sql|uuid|stack|password/i.test(body.message), false);
});

test("guardRequest: token tak dikenal → ditolak + cookie dibersihkan", async () => {
  const cookies = new MemoryCookies();
  cookies.put(SESSION_COOKIE, "token-palsu-tanpa-sesi-di-database-000000");
  const result = await guardRequest(db, cookies, req("/parent"));
  assert.equal(result.allowed, false);
  assert.deepEqual(cookies.deleted, [SESSION_COOKIE]);
});

test("guardRequest: sesi sah → diizinkan dengan parentId dari database", async () => {
  const reg = await registerParent(db, {
    email: "guard@contoh.id",
    displayName: "Guard",
    password: "sand1-kuat-99",
  });
  assert.ok(reg.ok);
  if (!reg.ok) return;

  const created = await createSession(db, reg.value.parentId);
  const cookies = new MemoryCookies();
  cookies.put(SESSION_COOKIE, created.token);

  const result = await guardRequest(db, cookies, req("/parent"));
  assert.equal(result.allowed, true);
  if (!result.allowed) return;
  assert.equal(result.session.parentId, reg.value.parentId);
  assert.equal(cookies.deleted.length, 0);
});

// ---------- kepemilikan profil anak (3.6–3.7) ----------

async function makeChild(parentId: string, nickname: string): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ($1::uuid, $2, 5) RETURNING id`,
    [parentId, nickname],
  );
  return rows.rows[0].id;
}

test("getChildForParent: pemilik mendapat profil, akun lain tidak", async () => {
  const owner = await registerParent(db, {
    email: "pemilik@contoh.id",
    displayName: "Pemilik",
    password: "sand1-kuat-99",
  });
  const other = await registerParent(db, {
    email: "lain@contoh.id",
    displayName: "Lain",
    password: "sand1-kuat-99",
  });
  assert.ok(owner.ok && other.ok);
  if (!owner.ok || !other.ok) return;

  const childId = await makeChild(owner.value.parentId, "Bintang");

  const mine = await getChildForParent(db, childId, owner.value.parentId);
  assert.ok(mine);
  assert.equal(mine?.nickname, "Bintang");
  assert.equal(mine?.age, 5);
  assert.equal(mine?.parentAccountId, owner.value.parentId);
  assert.equal(mine?.archivedAt, null);

  // akun lain → null (respons sama dengan "tidak ada", tanpa bocor keberadaan)
  const theirs = await getChildForParent(db, childId, other.value.parentId);
  assert.equal(theirs, null);

  // id acak yang valid format → null, bukan galat
  const unknown = await getChildForParent(
    db,
    "00000000-0000-4000-8000-000000000000",
    owner.value.parentId,
  );
  assert.equal(unknown, null);
});

test("getChildForParent: id bukan uuid valid → null tanpa galat database", async () => {
  const owner = await registerParent(db, {
    email: "uuid@contoh.id",
    displayName: "Uuid",
    password: "sand1-kuat-99",
  });
  assert.ok(owner.ok);
  if (!owner.ok) return;

  for (const bad of ["", "bukan-uuid", "1; DROP TABLE child_profile", "123"]) {
    assert.equal(await getChildForParent(db, bad, owner.value.parentId), null);
  }
  assert.equal(
    await getChildForParent(
      db,
      "00000000-0000-4000-8000-000000000000",
      "bukan-uuid",
    ),
    null,
  );
});

// ---------- middleware (3.5) ----------

type Handler = (
  context: unknown,
  next: () => Promise<Response>,
) => Promise<Response>;
const onRequest = middleware.onRequest as unknown as Handler;

function fakeContext(path: string, cookies: MemoryCookies) {
  return {
    request: req(path),
    cookies,
    locals: {} as Record<string, unknown>,
  };
}

test("middleware: rute publik diteruskan tanpa cek sesi", async () => {
  let called = 0;
  const next = async () => {
    called += 1;
    return new Response("ok");
  };
  const res = await onRequest(fakeContext("/", new MemoryCookies()), next);
  assert.equal(called, 1);
  assert.equal(res.status, 200);
});

test("middleware: /parent tanpa sesi → 303 ke /login, handler tidak jalan", async () => {
  let called = 0;
  const next = async () => {
    called += 1;
    return new Response("ok");
  };
  const res = await onRequest(
    fakeContext("/parent", new MemoryCookies()),
    next,
  );
  assert.equal(called, 0);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/login");
});

test("middleware: /parent dengan sesi sah → handler jalan + locals terisi", async () => {
  const reg = await registerParent(db, {
    email: "mw@contoh.id",
    displayName: "Middleware",
    password: "sand1-kuat-99",
  });
  assert.ok(reg.ok);
  if (!reg.ok) return;
  const created = await createSession(db, reg.value.parentId);

  const cookies = new MemoryCookies();
  cookies.put(SESSION_COOKIE, created.token);
  const context = fakeContext("/parent", cookies);

  let called = 0;
  const next = async () => {
    called += 1;
    return new Response("dasbor");
  };
  const res = await onRequest(context, next);

  assert.equal(called, 1);
  assert.equal(res.status, 200);
  const locals = context.locals as { parentSession?: { parentId: string } };
  assert.equal(locals.parentSession?.parentId, reg.value.parentId);
});

test("middleware: endpoint terlindungi tanpa sesi → 401, handler tidak jalan", async () => {
  let called = 0;
  const next = async () => {
    called += 1;
    return new Response("ok");
  };
  const res = await onRequest(
    fakeContext("/api/parent/children", new MemoryCookies()),
    next,
  );
  assert.equal(called, 0);
  assert.equal(res.status, 401);
});
