/**
 * VRD Phase 3 — Authentication and Parent Ownership (3.1–3.4, 3.8, 3.10, 3.11).
 *
 * Menguji lapisan inti (hash, akun, sesi) dan endpoint sungguhan Astro lewat
 * konteks tiruan, termasuk flag cookie, kedaluwarsa sesi, cabut sesi, dan
 * penolakan permintaan lintas-asal. Database in-memory bersih per file test.
 *
 * Catatan: proteksi rute orang tua (3.5), API profil anak (3.6–3.7), rate
 * limiting (3.9) dan UI login/daftar dikerjakan pada run VRD berikutnya.
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
const {
  hashPassword,
  verifyPassword,
  isPasswordLengthValid,
  PASSWORD_MIN_LENGTH,
} = await import("../src/lib/auth/password.ts");
const {
  registerParent,
  loginParent,
  getParentById,
  safeMessage,
} = await import("../src/lib/auth/accounts.ts");
const {
  createSession,
  resolveSession,
  revokeSession,
  revokeAllSessions,
  purgeExpiredSessions,
  SESSION_COOKIE,
  sessionTtlMs,
} = await import("../src/lib/auth/session.ts");
const registerRoute = await import("../src/pages/api/auth/register.ts");
const loginRoute = await import("../src/pages/api/auth/login.ts");
const logoutRoute = await import("../src/pages/api/auth/logout.ts");
const sessionRoute = await import("../src/pages/api/auth/session.ts");

after(async () => {
  await closeDb();
});

// ---------- pembantu ----------

const ORIGIN = "http://localhost:4321";

interface CookieEntry {
  value: string;
  opts: Record<string, unknown>;
}

/** Tiruan minimal AstroCookies: cukup untuk memantau set/delete/get. */
class FakeCookies {
  store = new Map<string, CookieEntry>();

  get(name: string): { value: string } | undefined {
    const entry = this.store.get(name);
    return entry === undefined ? undefined : { value: entry.value };
  }
  set(name: string, value: string, opts: Record<string, unknown>): void {
    this.store.set(name, { value, opts });
  }
  delete(name: string): void {
    this.store.delete(name);
  }
  has(name: string): boolean {
    return this.store.has(name);
  }
}

function makeRequest(
  path: string,
  init: { method?: string; body?: unknown; origin?: string; rawBody?: string } = {},
): Request {
  const method = init.method ?? (init.body !== undefined || init.rawBody !== undefined ? "POST" : "GET");
  const body = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", init.origin ?? ORIGIN);
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: { request: Request; cookies: FakeCookies }): Promise<Response> {
  return handler(ctx);
}

let seq = 0;
function nextEmail(): string {
  seq += 1;
  return `orang${seq}@contoh.id`;
}

// ---------- 3.1 hashing ----------

test("3.1 hash kata sandi: scrypt bersalt, tidak plaintext, verifikasi ketat", async () => {
  const plain = "kata-sandi-rahas1a";
  const hash = await hashPassword(plain);

  assert.ok(hash.startsWith("scrypt$16384$8$1$"), "format hash modular scrypt");
  assert.ok(!hash.includes(plain), "kata sandi tidak boleh muncul di hash");
  assert.equal(isPasswordLengthValid(plain), true);

  assert.equal(await verifyPassword(plain, hash), true);
  assert.equal(await verifyPassword("kata-sandi-salah1", hash), false);
  // Hash rusak / algoritem tak dikenal = gagal, bukan lempar error.
  assert.equal(await verifyPassword(plain, "bcrypt$2$abc"), false);
  assert.equal(await verifyPassword(plain, "scrypt$16384$8$1$@@@$$$"), false);
  assert.equal(await verifyPassword(plain, ""), false);

  await assert.rejects(
    () => hashPassword("pendek"),
    new RegExp(`${PASSWORD_MIN_LENGTH}`),
  );
  assert.equal(isPasswordLengthValid("x".repeat(PASSWORD_MIN_LENGTH - 1)), false);
});

// ---------- 3.1 registrasi via endpoint ----------

test("3.1 POST /api/auth/register: akun dibuat, hash tersimpan, cookie sesi terpasang", async () => {
  const cookies = new FakeCookies();
  const password = "sand1-kuat-99";
  const res = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: { email: " Budi@Contoh.ID ", displayName: "Budi", password },
    }),
    cookies,
  });

  assert.equal(res.status, 201, await res.clone().text());
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.displayName, "Budi");
  assert.equal(res.headers.get("cache-control"), "no-store");

  // Email dinormalisasi (trim + lowercase)
  const row = await db.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM parent_account WHERE id = $1::uuid",
    [body.parentId],
  );
  assert.equal(row.rows.length, 1);
  assert.equal(row.rows[0].email, "budi@contoh.id");
  assert.ok(row.rows[0].password_hash.startsWith("scrypt$"));
  assert.ok(!row.rows[0].password_hash.includes(password), "password tidak plaintext");

  // Cookie: HttpOnly + SameSite=Lax + Path=/ (SECURITY-PRIVACY: secure session)
  const entry = cookies.store.get(SESSION_COOKIE);
  assert.ok(entry, "cookie sesi tidak terpasang");
  assert.equal(entry.opts.httpOnly, true);
  assert.equal(entry.opts.sameSite, "lax");
  assert.equal(entry.opts.path, "/");
  assert.ok(String(entry.value).length >= 40, "token sesi terlalu pendek");

  // Token mentah TIDAK pernah masuk database — hanya hash-nya.
  const leak = await db.query<{ count: string }>(
    `SELECT count(*) AS count FROM parent_session
      WHERE token_hash = $1 OR token_hash = $2`,
    [entry.value, entry.value],
  );
  assert.equal(Number(leak.rows[0].count), 0, "token mentah bocor ke database");
  const stored = await db.query<{ token_hash: string }>(
    "SELECT token_hash FROM parent_session WHERE parent_account_id = $1::uuid",
    [body.parentId],
  );
  assert.equal(stored.rows.length, 1);
  assert.match(stored.rows[0].token_hash, /^[0-9a-f]{64}$/);

  // Sesi langsung sah dan terikat pada orang tua yang benar.
  const session = await resolveSession(db, entry.value);
  assert.ok(session);
  assert.equal(session.parentId, body.parentId);
});

test("3.1 email terdaftar ditolak 409 — termasuk beda kapital & spasi", async () => {
  const email = nextEmail();
  const cookies = new FakeCookies();
  const res = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: { email, displayName: "Sari", password: "sand1-kuat-99" },
    }),
    cookies,
  });
  assert.equal(res.status, 201);

  const dup = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: {
        email: `  ${email.toUpperCase()}  `,
        displayName: "Sari Dua",
        password: "sand1-kuat-99",
      },
    }),
    cookies: new FakeCookies(),
  });
  assert.equal(dup.status, 409);
  const body = await dup.json();
  assert.equal(body.error, "EMAIL_TAKEN");
  assert.equal(body.message, safeMessage("EMAIL_TAKEN"));
  // Pesan aman: tanpa detail internal (VRD 3.10)
  assert.ok(!/sql|hash|constraint|stack|duplicate/i.test(body.message));
});

test("3.10 input registrasi tidak valid = 400 dengan pesan aman", async () => {
  const cases = [
    { email: "bukan-email", displayName: "A", password: "sand1-kuat-99" },
    { email: "ok@contoh.id", displayName: "", password: "sand1-kuat-99" },
    { email: "ok@contoh.id", displayName: "A", password: "pendek" },
    { email: "", displayName: "A", password: "sand1-kuat-99" },
  ];
  for (const payload of cases) {
    const res = await call(registerRoute.POST, {
      request: makeRequest("/api/auth/register", { body: payload }),
      cookies: new FakeCookies(),
    });
    assert.equal(res.status, 400, JSON.stringify(payload));
    const body = await res.json();
    assert.equal(body.error, "INVALID_INPUT");
    assert.deepEqual(Object.keys(body).sort(), ["error", "message"]);
  }
});

// ---------- 3.2 login ----------

test("3.2 login sukses mengeluarkan sesi baru", async () => {
  const reg = await registerParent(db, {
    email: "citra@contoh.id",
    displayName: "Citra",
    password: "sand1-kuat-99",
  });
  assert.equal(reg.ok, true);

  const cookies = new FakeCookies();
  const res = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", { body: { email: "  CITRA@CONTOH.ID", password: "sand1-kuat-99" } }),
    cookies,
  });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.displayName, "Citra");
  const entry = cookies.store.get(SESSION_COOKIE);
  assert.ok(entry);
  const session = await resolveSession(db, entry.value);
  assert.ok(session);
  assert.equal(session.parentId, body.parentId);
});

test("3.11 login gagal seragam: email salah = kata sandi salah (tanpa oracle)", async () => {
  const email = nextEmail();
  await registerParent(db, {
    email,
    displayName: "Dewi",
    password: "sand1-kuat-99",
  });

  const wrongPassword = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", { body: { email, password: "salah-banget1" } }),
    cookies: new FakeCookies(),
  });
  const unknownEmail = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      body: { email: "belum-daftar@contoh.id", password: "salah-banget1" },
    }),
    cookies: new FakeCookies(),
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  const a = await wrongPassword.json();
  const b = await unknownEmail.json();
  assert.equal(a.error, "INVALID_CREDENTIALS");
  assert.equal(a.error, b.error, "kode kegagalan wajib identik");
  assert.equal(a.message, b.message, "pesan kegagalan wajib identik");
  assert.equal(a.message, safeMessage("INVALID_CREDENTIALS"));
  // Tidak ada cookie sesi yang terpasang saat login gagal.
  // (dicek lewat response Set-Cookie yang tidak boleh ada)
  assert.equal(wrongPassword.headers.get("set-cookie"), null);

  // Body error tidak pernah memuat detail internal.
  for (const body of [a, b]) {
    assert.ok(!/hash|scrypt|sql|stack|column|relation/i.test(JSON.stringify(body)));
  }
});

// ---------- 3.4 kedaluwarsa & pencabutan sesi ----------

test("3.4 sesi kedaluwarsa, dicabut, dan dibersihkan", async () => {
  const parentA = await registerParent(db, {
    email: nextEmail(),
    displayName: "Ayu",
    password: "sand1-kuat-99",
  });
  const parentB = await registerParent(db, {
    email: nextEmail(),
    displayName: "Beni",
    password: "sand1-kuat-99",
  });
  assert.ok(parentA.ok && parentB.ok);
  if (!parentA.ok || !parentB.ok) return;

  const sessionA = await createSession(db, parentA.value.parentId);
  const sessionB = await createSession(db, parentB.value.parentId);

  // Terikat pada pemiliknya masing-masing (dasar otorisasi server-side).
  const resolvedA = await resolveSession(db, sessionA.token);
  const resolvedB = await resolveSession(db, sessionB.token);
  assert.equal(resolvedA?.parentId, parentA.value.parentId);
  assert.equal(resolvedB?.parentId, parentB.value.parentId);
  assert.notEqual(resolvedA?.sessionId, resolvedB?.sessionId);

  // Default kedaluwarsa positif & sesuai konfigurasi (VRD 3.4).
  assert.ok(sessionTtlMs() > 0);
  assert.ok(sessionA.expiresAt.getTime() > Date.now());

  // Kedaluwarsa: token yang lewat masa berlaku tidak sah lagi.
  // (created_at ikut dimundurkan agar tetap memenuhi CHECK expires_at > created_at.)
  await db.query(
    `UPDATE parent_session
        SET created_at = now() - interval '2 days',
            expires_at = now() - interval '1 minute'
      WHERE id = $1::uuid`,
    [sessionA.sessionId],
  );
  assert.equal(await resolveSession(db, sessionA.token), null, "sesi kedaluwarsa masih dianggap sah");
  assert.ok(await resolveSession(db, sessionB.token), "sesi lain ikut mati");

  // Dicabut (logout).
  await revokeSession(db, sessionB.token);
  assert.equal(await resolveSession(db, sessionB.token), null, "sesi dicabut masih sah");
  await revokeSession(db, sessionB.token); // idempoten
  assert.equal(await resolveSession(db, "token-asing-yang-tidak-dikenal-000"), null);

  // Pembersihan baris kedaluwarsa.
  const purged = await purgeExpiredSessions(db);
  assert.ok(purged >= 1, "sesi kedaluwarsa tidak dibersihkan");
  const left = await db.query<{ count: string }>(
    "SELECT count(*) AS count FROM parent_session WHERE id = $1::uuid",
    [sessionA.sessionId],
  );
  assert.equal(Number(left.rows[0].count), 0);

  // Cabut semua sesi seorang orang tua.
  const s1 = await createSession(db, parentA.value.parentId);
  const s2 = await createSession(db, parentA.value.parentId);
  const revoked = await revokeAllSessions(db, parentA.value.parentId);
  assert.ok(revoked >= 2, `hanya ${revoked} sesi dicabut`);
  assert.equal(await resolveSession(db, s1.token), null);
  assert.equal(await resolveSession(db, s2.token), null);
});

// ---------- 3.3 logout ----------

test("3.3 logout: sesi dicabut, cookie dihapus, status sesi ikut turun", async () => {
  const cookies = new FakeCookies();
  const reg = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: { email: nextEmail(), displayName: "Eka", password: "sand1-kuat-99" },
    }),
    cookies,
  });
  assert.equal(reg.status, 201);
  const token = cookies.store.get(SESSION_COOKIE)?.value;
  assert.ok(token);

  // Sesudah login, GET sesi melaporkan autentik.
  const before = await call(sessionRoute.GET, { request: makeRequest("/api/auth/session"), cookies });
  const beforeBody = await before.json();
  assert.equal(beforeBody.authenticated, true);
  assert.equal(beforeBody.displayName, "Eka");

  const out = await call(logoutRoute.POST, {
    request: makeRequest("/api/auth/logout", { body: {} }),
    cookies,
  });
  assert.equal(out.status, 200);
  assert.equal((await out.json()).ok, true);
  assert.equal(cookies.store.has(SESSION_COOKIE), false, "cookie tidak dihapus");
  assert.equal(await resolveSession(db, token!), null, "sesi tidak dicabut di server");

  const after = await call(sessionRoute.GET, { request: makeRequest("/api/auth/session"), cookies });
  assert.equal((await after.json()).authenticated, false);

  // Logout tanpa sesi tetap sukses (idempoten).
  const bare = await call(logoutRoute.POST, {
    request: makeRequest("/api/auth/logout", { body: {} }),
    cookies: new FakeCookies(),
  });
  assert.equal(bare.status, 200);
});

test("GET /api/auth/session: cookie basi dibersihkan, tanpa cache", async () => {
  const res = await call(sessionRoute.GET, {
    request: makeRequest("/api/auth/session"),
    cookies: new FakeCookies(),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.authenticated, false);
  assert.deepEqual(Object.keys(body), ["authenticated"]);

  const stale = new FakeCookies();
  stale.set(SESSION_COOKIE, "token-lama-tapi-panjang-yang-tidak-terdaftar", {});
  const res2 = await call(sessionRoute.GET, {
    request: makeRequest("/api/auth/session"),
    cookies: stale,
  });
  const body2 = await res2.json();
  assert.equal(body2.authenticated, false);
  assert.equal(stale.store.has(SESSION_COOKIE), false, "cookie basi tidak dibersihkan");
});

// ---------- 3.8 perlindungan lintas-asal (CSRF berlapis) ----------

test("3.8 permintaan lintas-asal ditolak dan tidak memasang sesi", async () => {
  const cookies = new FakeCookies();
  const res = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: { email: nextEmail(), displayName: "Fajar", password: "sand1-kuat-99" },
      origin: "https://penjahat.example",
    }),
    cookies,
  });
  assert.equal(res.status, 403);
  assert.equal(cookies.store.size, 0, "sesi terpasang walau origin ditolak");

  const login = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      body: { email: "orang1@contoh.id", password: "sand1-kuat-99" },
      origin: "https://penjahat.example",
    }),
    cookies: new FakeCookies(),
  });
  assert.equal(login.status, 403);
  assert.equal(login.headers.get("set-cookie"), null);
});

// ---------- 3.10 body rusak ----------

test("3.10 body bukan JSON / kebesaran ditolak dengan pesan aman", async () => {
  const bad = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", { rawBody: "<script>alert(1)</script>" }),
    cookies: new FakeCookies(),
  });
  assert.equal(bad.status, 400);
  const body = await bad.json();
  assert.equal(body.error, "INVALID_INPUT");
  assert.ok(!/script|alert/i.test(body.message));

  const huge = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      rawBody: JSON.stringify({ email: "a@b.id", password: "x".repeat(500000) }),
    }),
    cookies: new FakeCookies(),
  });
  assert.equal(huge.status, 400);

  // Body berupa array bukan objek -> ditolak.
  const arr = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", { rawBody: "[1,2,3]" }),
    cookies: new FakeCookies(),
  });
  assert.equal(arr.status, 400);
});

// ---------- acceptance ----------

test("acceptance: kredensial tidak pernah terkirim balik & akun bisa dibaca ulang", async () => {
  const email = nextEmail();
  const password = "sand1-kuat-99";
  const reg = await registerParent(db, { email, displayName: "Gita", password });
  assert.ok(reg.ok);
  if (!reg.ok) return;

  const parent = await getParentById(db, reg.value.parentId);
  assert.ok(parent);
  assert.equal(parent.displayName, "Gita");
  assert.equal("password" in parent, false, "identitas tidak boleh memuat kredensial");
  assert.equal("passwordHash" in parent, false);

  const login = await loginParent(db, { email, password });
  assert.ok(login.ok);
  if (login.ok) assert.equal(login.value.parentId, reg.value.parentId);

  // Entri di tabel sesi tidak memuat field apa pun selain hash.
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'parent_session'`,
  );
  const names = cols.rows.map((c) => c.column_name).sort();
  assert.deepEqual(names, [
    "created_at",
    "expires_at",
    "id",
    "parent_account_id",
    "revoked_at",
    "token_hash",
    "updated_at",
  ]);
});
