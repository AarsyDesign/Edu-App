/**
 * Smoke test E2E autentikasi (VRD Phase 3).
 *
 * Menjalankan server hasil `npm run build`, menguji endpoint auth sungguhan
 * lewat HTTP (bukan konteks tiruan), lalu mematikan server sendiri.
 * Pemakaian: `npm run build && node scripts/smoke-auth.mjs`
 * Output terakhir: SMOKE_OK (lulus) atau SMOKE_GAGAL=<n>.
 *
 * Database memakai folder terpisah yang dihapus tiap awal run supaya hasil
 * selalu deterministik; folder itu masuk .gitignore (.data/).
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

const PORT = 4399;
// Adapter node hanya mem-bind localhost (IPv6 ::1); Node fetch tidak ikut
// happy eyeballs ke 127.0.0.1, jadi alamat eksplisit dipakai di sini.
const base = `http://[::1]:${PORT}`;
const origin = base;
const DB_DIR = path.join(process.cwd(), ".data", "smoke-pglite");

await rm(DB_DIR, { recursive: true, force: true });

const server = spawn("node", ["./dist/server/entry.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), PGLITE_DIR: DB_DIR },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
server.stderr.on("data", (d) => process.stdout.write(`[srv-err] ${d}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) return;
    } catch {
      /* belum siap */
    }
    await sleep(500);
  }
  throw new Error("server tidak siap");
}

const jar = new Map();
function absorbCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1);
    if (v === "" || /expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k);
    else jar.set(k, { value: v, raw: c });
  }
}
const cookieHeader = () => [...jar.entries()].map(([k, e]) => `${k}=${e.value}`).join("; ");

async function post(path, body, overrideOrigin = origin) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: overrideOrigin,
      ...(jar.size ? { cookie: cookieHeader() } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  absorbCookies(res);
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, setCookie: res.headers.getSetCookie?.() ?? [] };
}

async function get(path) {
  const res = await fetch(base + path, { headers: jar.size ? { cookie: cookieHeader() } : {} });
  absorbCookies(res);
  return { status: res.status, body: await res.json() };
}

/** GET apa pun tanpa memaksa JSON (dipakai untuk halaman & cek proteksi rute). */
async function getRaw(path) {
  const res = await fetch(base + path, {
    headers: jar.size ? { cookie: cookieHeader() } : {},
    redirect: "manual",
  });
  absorbCookies(res);
  return {
    status: res.status,
    location: res.headers.get("location"),
    body: await res.text(),
  };
}

let failed = 0;
function check(label, cond, detail = "") {
  if (cond) console.log(`✔ ${label}`);
  else {
    failed += 1;
    console.log(`✖ ${label} ${detail}`);
  }
}

try {
  await waitForServer();

  // --- proteksi rute (VRD 3.5) sebelum ada sesi ---
  const anonPage = await getRaw("/parent");
  console.log("anon /parent:", anonPage.status, anonPage.location);
  check(
    "/parent tanpa sesi → 303 ke /login",
    anonPage.status === 303 && String(anonPage.location).endsWith("/login"),
  );
  const anonApi = await getRaw("/api/parent/children");
  console.log("anon api:", anonApi.status, anonApi.body.slice(0, 120));
  check("/api/parent/* tanpa sesi → 401 JSON", anonApi.status === 401);
  const homeAnon = await getRaw("/");
  check("/ tetap publik", homeAnon.status === 200);

  const reg = await post("/api/auth/register", {
    email: "Smoke@Contoh.id",
    displayName: "Smoke",
    password: "sand1-kuat-99",
  });
  console.log("register:", reg.status, JSON.stringify(reg.body));
  console.log(
    "set-cookie:",
    reg.setCookie.map((c) => c.split(";").map((s) => s.trim()).join(" | ")).join("  ;;  "),
  );
  check("register 201", reg.status === 201);
  check("cookie HttpOnly", reg.setCookie.join(" ").includes("HttpOnly"));
  check("cookie SameSite=Lax", /samesite=lax/i.test(reg.setCookie.join(" ")));
  check("cookie Path=/", /path=\//i.test(reg.setCookie.join(" ")));

  const sess = await get("/api/auth/session");
  console.log("session:", JSON.stringify(sess.body));
  check("session autentik", sess.body.authenticated === true && sess.body.displayName === "Smoke");

  // --- proteksi rute dengan sesi sah ---
  const authedPage = await getRaw("/parent");
  console.log("authed /parent:", authedPage.status, authedPage.body.slice(0, 60));
  check(
    "/parent dengan sesi → 200 halaman orang tua",
    authedPage.status === 200 && authedPage.body.includes("Area Orang Tua"),
  );

  const dup = await post("/api/auth/register", {
    email: "smoke@contoh.id",
    displayName: "Lain",
    password: "sand1-kuat-99",
  });
  console.log("dup:", dup.status, JSON.stringify(dup.body));
  check("duplikat 409", dup.status === 409);

  const badLogin = await post("/api/auth/login", {
    email: "smoke@contoh.id",
    password: "salah-satu-99",
  });
  const noLogin = await post("/api/auth/login", {
    email: "tidak-ada@contoh.id",
    password: "salah-satu-99",
  });
  console.log("login salah:", badLogin.status, JSON.stringify(badLogin.body));
  console.log("login tak ada:", noLogin.status, JSON.stringify(noLogin.body));
  check(
    "login gagal seragam (401 + pesan identik)",
    badLogin.status === 401 &&
      noLogin.status === 401 &&
      JSON.stringify(badLogin.body) === JSON.stringify(noLogin.body),
  );

  const cross = await post(
    "/api/auth/register",
    { email: "x@y.id", displayName: "X", password: "sand1-kuat-99" },
    "https://jahat.example",
  );
  console.log("cross-origin:", cross.status, JSON.stringify(cross.body));
  check("origin lintas-asal ditolak 403", cross.status === 403);

  const out = await post("/api/auth/logout", {});
  console.log("logout:", out.status, JSON.stringify(out.body));
  check("logout 200", out.status === 200);

  const after = await get("/api/auth/session");
  console.log("session sesudah logout:", JSON.stringify(after.body));
  check("sesi turun sesudah logout", after.body.authenticated === false);

  const afterLogout = await getRaw("/parent");
  console.log("/parent sesudah logout:", afterLogout.status, afterLogout.location);
  check(
    "/parent sesudah logout → dialihkan ke /login",
    afterLogout.status === 303 && String(afterLogout.location).endsWith("/login"),
  );

  const notFound = await post("/api/auth/login", { email: "" });
  check("body tidak valid 400", notFound.status === 400);
} catch (err) {
  failed += 1;
  console.error("SMOKE_FAIL", err);
} finally {
  server.kill("SIGTERM");
  await sleep(300);
  if (!server.killed) server.kill("SIGKILL");
}

console.log(failed === 0 ? "SMOKE_OK" : `SMOKE_GAGAL=${failed}`);
process.exit(failed === 0 ? 0 : 1);
