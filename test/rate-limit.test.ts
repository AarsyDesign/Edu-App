/**
 * VRD 3.9 — rate limiting endpoint autentikasi.
 *
 * Menguji: jendela tetap (kuota habis → 429 + retry-after → pulih setelah
 * jendela), pemisahan kunci antar endpoint, pembatasan memori, fallback
 * kunci klien, pesan aman tanpa detail internal, dan urutan cek (asal
 * lintas-asal ditolak sebelum kuota dipakai).
 *
 * Database in-memory bersih per file test.
 */
import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Batas sengaja kecil supaya kuota habis cepat; dibaca per panggilan.
process.env.RATE_LIMIT_LOGIN_MAX = "3";
process.env.RATE_LIMIT_REGISTER_MAX = "3";
process.env.RATE_LIMIT_WINDOW_MIN = "15";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const db = await (async () => {
  const mod = await import("../src/lib/db/index.ts");
  return mod.getDb();
})();
const { closeDb } = await import("../src/lib/db/index.ts");
const {
  consumeRateLimit,
  loginRateRule,
  registerRateRule,
  clientKey,
  rateLimitResponse,
  resetRateLimits,
  RATE_LIMIT_DEFAULTS,
} = await import("../src/lib/auth/rate-limit.ts");
const loginRoute = await import("../src/pages/api/auth/login.ts");
const registerRoute = await import("../src/pages/api/auth/register.ts");

after(async () => {
  await closeDb();
});

beforeEach(() => {
  resetRateLimits();
});

const ORIGIN = "http://localhost:4321";

class FakeCookies {
  store = new Map<string, { value: string; opts: Record<string, unknown> }>();
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
}

function makeRequest(
  path: string,
  init: { body?: unknown; origin?: string } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", init.origin ?? ORIGIN);
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(init.body ?? {}),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: Record<string, unknown>): Promise<Response> {
  return handler(ctx);
}

// ---------- unit: jendela tetap ----------

test("3.9 kuota habis → ditolak dengan retry-after, pulih setelah jendela", () => {
  const rule = { max: 3, windowMs: 60_000 };
  const t0 = 1_000_000;

  assert.deepEqual(consumeRateLimit("uji:ip", rule, t0), {
    allowed: true,
    retryAfterSec: 0,
    remaining: 2,
  });
  assert.deepEqual(consumeRateLimit("uji:ip", rule, t0 + 10), {
    allowed: true,
    retryAfterSec: 0,
    remaining: 1,
  });
  assert.deepEqual(consumeRateLimit("uji:ip", rule, t0 + 20), {
    allowed: true,
    retryAfterSec: 0,
    remaining: 0,
  });

  const blocked = consumeRateLimit("uji:ip", rule, t0 + 30);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec > 0 && blocked.retryAfterSec <= 60);
  assert.equal(blocked.remaining, 0);

  // Selama jendela belum lewat, tetap ditolak.
  assert.equal(consumeRateLimit("uji:ip", rule, t0 + 59_000).allowed, false);

  // Lewat jendela → kuota penuh lagi.
  const renewed = consumeRateLimit("uji:ip", rule, t0 + 60_001);
  assert.equal(renewed.allowed, true);
  assert.equal(renewed.remaining, 2);
});

test("3.9 kunci terpisah: login tidak menghabiskan kuota register", () => {
  const rule = { max: 1, windowMs: 60_000 };
  const t0 = 2_000_000;
  assert.equal(consumeRateLimit("login:ip-x", rule, t0).allowed, true);
  assert.equal(consumeRateLimit("login:ip-x", rule, t0).allowed, false);
  // Endpoint/klien berbeda = kuota berbeda.
  assert.equal(consumeRateLimit("register:ip-x", rule, t0).allowed, true);
  assert.equal(consumeRateLimit("login:ip-y", rule, t0).allowed, true);
});

test("3.9 aturan membaca env; nilai tak valid jatuh ke default aman", () => {
  assert.equal(loginRateRule().max, 3);
  assert.equal(registerRateRule().max, 3);
  assert.equal(loginRateRule().windowMs, 15 * 60_000);
  assert.equal(RATE_LIMIT_DEFAULTS.loginMax, 15);

  process.env.RATE_LIMIT_LOGIN_MAX = "bukan-angka";
  assert.equal(loginRateRule().max, RATE_LIMIT_DEFAULTS.loginMax);
  process.env.RATE_LIMIT_LOGIN_MAX = "-5";
  assert.equal(loginRateRule().max, RATE_LIMIT_DEFAULTS.loginMax);
  process.env.RATE_LIMIT_LOGIN_MAX = "0";
  assert.equal(loginRateRule().max, RATE_LIMIT_DEFAULTS.loginMax);
  process.env.RATE_LIMIT_LOGIN_MAX = "3"; // kembalikan untuk test berikutnya
});

test("3.9 penghitung memori dibatasi (kunci kedaluwarsa dibuang)", () => {
  const rule = { max: 5, windowMs: 1_000 };
  const t0 = 3_000_000;
  // Ribuan kunci aktif → tidak meledak, kuota tetap berfungsi.
  for (let i = 0; i < 5_200; i += 1) {
    consumeRateLimit(`banjir:${i}`, rule, t0);
  }
  assert.equal(consumeRateLimit("banjir:barupun", rule, t0).allowed, true);
  resetRateLimits();
  assert.equal(consumeRateLimit("uji:ip", rule, t0).allowed, true);
});

test("3.9 clientKey: alamat konteks dipakai, tanpa alamat → 'unknown'", () => {
  assert.equal(clientKey({ clientAddress: "203.0.113.9" }), "203.0.113.9");
  assert.equal(clientKey({}), "unknown");
  assert.equal(clientKey(undefined), "unknown");
  // Konteks yang melempar saat alamat dibaca (adapter tanpa dukungan).
  const throwing = {
    get clientAddress(): string {
      throw new Error("adapter tanpa alamat");
    },
  };
  assert.equal(clientKey(throwing), "unknown");
});

test("3.9 respons 429: JSON aman + retry-after + tanpa cache", async () => {
  const res = rateLimitResponse(42);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "42");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const body = (await res.json()) as { error: string; message: string };
  assert.equal(body.error, "RATE_LIMITED");
  assert.deepEqual(Object.keys(body).sort(), ["error", "message"]);
  assert.ok(body.message.length > 0);
  assert.equal(/sql|hash|stack|scrypt|uuid/i.test(body.message), false);
});

// ---------- integrasi endpoint ----------

test("3.9 POST /api/auth/login: kuota habis → 429 sebelum scrypt", async () => {
  let last: Response | null = null;
  for (let i = 0; i < 3; i += 1) {
    last = await call(loginRoute.POST, {
      request: makeRequest("/api/auth/login", {
        body: { email: `mayem${i}@contoh.id`, password: "salah-banget1" },
      }),
      cookies: new FakeCookies(),
      clientAddress: "198.51.100.7",
    });
    assert.equal(last.status, 401, `percobaan ke-${i + 1} seharusnya 401`);
  }

  // Percobaan ke-5: kuota (3) habis.
  const blocked = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      body: { email: "mayem@contoh.id", password: "salah-banget1" },
    }),
    cookies: new FakeCookies(),
    clientAddress: "198.51.100.7",
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  const body = (await blocked.json()) as { error: string; message: string };
  assert.equal(body.error, "RATE_LIMITED");
  assert.equal(blocked.headers.get("set-cookie"), null);

  // Klien lain tidak terkena (kunci per alamat).
  const other = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      body: { email: "mayem@contoh.id", password: "salah-banget1" },
    }),
    cookies: new FakeCookies(),
    clientAddress: "198.51.100.8",
  });
  assert.equal(other.status, 401);
});

test("3.9 POST /api/auth/register: kuota habis → 429, akun tidak dibuat", async () => {
  for (let i = 0; i < 3; i += 1) {
    const res = await call(registerRoute.POST, {
      request: makeRequest("/api/auth/register", {
        body: { email: `daftar${i}@contoh.id`, displayName: "Dupa", password: "sand1-kuat-99" },
      }),
      cookies: new FakeCookies(),
      clientAddress: "198.51.100.20",
    });
    assert.equal(res.status, 201, `pendaftaran ke-${i + 1} seharusnya 201`);
  }

  const blocked = await call(registerRoute.POST, {
    request: makeRequest("/api/auth/register", {
      body: { email: "daftar-kelebihan@contoh.id", displayName: "Dupa", password: "sand1-kuat-99" },
    }),
    cookies: new FakeCookies(),
    clientAddress: "198.51.100.20",
  });
  assert.equal(blocked.status, 429);
  const body = (await blocked.json()) as { error: string };
  assert.equal(body.error, "RATE_LIMITED");

  const stored = await db.query<{ count: string }>(
    "SELECT count(*) AS count FROM parent_account WHERE email = $1",
    ["daftar-kelebihan@contoh.id"],
  );
  assert.equal(Number(stored.rows[0].count), 0, "akun terbentuk walau 429");
});

test("3.9 lintas-asal ditolak 403 SEBELUM kuota dipakai", async () => {
  const res = await call(loginRoute.POST, {
    request: makeRequest("/api/auth/login", {
      body: { email: "x@y.id", password: "salah-banget1" },
      origin: "https://jahat.example",
    }),
    cookies: new FakeCookies(),
    clientAddress: "198.51.100.30",
  });
  assert.equal(res.status, 403);
  // Kuota klien itu masih utuh: 3 percobaan sah diperbolehkan.
  for (let i = 0; i < 3; i += 1) {
    const attempt = await call(loginRoute.POST, {
      request: makeRequest("/api/auth/login", {
        body: { email: "lagi@contoh.id", password: "salah-banget1" },
      }),
      cookies: new FakeCookies(),
      clientAddress: "198.51.100.30",
    });
    assert.equal(attempt.status, 401, `kuota terpakai lintas-asal (percobaan ${i + 1})`);
  }
});
