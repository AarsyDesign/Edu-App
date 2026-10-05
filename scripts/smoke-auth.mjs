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
  env: {
    ...process.env,
    PORT: String(PORT),
    PGLITE_DIR: DB_DIR,
    // Kuota sengaja kecil supaya smoke bisa membuktikan 429 sungguhan (VRD 3.9).
    RATE_LIMIT_LOGIN_MAX: "3",
    RATE_LIMIT_REGISTER_MAX: "10",
  },
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
  return request("POST", path, body, overrideOrigin);
}

/** Permintaan JSON umum (POST/PATCH/DELETE) dengan cookie & header Origin. */
async function request(method, path, body, overrideOrigin = origin) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: overrideOrigin,
      ...(jar.size ? { cookie: cookieHeader() } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
  const anonChildren = await getRaw("/api/children");
  check("/api/children tanpa sesi → 401 JSON", anonChildren.status === 401);
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

  // --- profil anak (VRD Phase 4) lewat HTTP sungguhan ---
  const child = await post("/api/children", {
    nickname: "Nusa",
    age: 5,
    learningGoals: ["Mengenal angka"],
  });
  console.log("create child:", child.status, JSON.stringify(child.body));
  check("create profil anak 201", child.status === 201 && child.body?.child?.nickname === "Nusa");
  const childId = child.body?.child?.childId;
  check(
    "respons anak tanpa parentAccountId",
    typeof childId === "string" && !("parentAccountId" in (child.body?.child ?? {})),
  );

  const childList = await get("/api/children");
  check(
    "daftar anak aktif berisi 1 profil",
    childList.status === 200 && childList.body?.children?.length === 1,
  );

  const childDup = await post("/api/children", { nickname: " nusa ", age: 6 });
  check("nickname duplikat → 409 NICKNAME_TAKEN", childDup.status === 409);

  const childBadAge = await post("/api/children", { nickname: "Salah Usia", age: 99 });
  check("usia di luar 3–7 → 400", childBadAge.status === 400);

  const childPatch = await request("PATCH", `/api/children/${childId}`, { age: 6 });
  console.log("patch child:", childPatch.status, JSON.stringify(childPatch.body));
  check(
    "PATCH profil anak 200 + usia berubah",
    childPatch.status === 200 && childPatch.body?.child?.age === 6,
  );

  const childMissing = await request(
    "PATCH",
    "/api/children/00000000-0000-4000-8000-000000000000",
    { nickname: "Tidak Ada" },
  );
  check("PATCH id tak dikenal → 404", childMissing.status === 404);

  const childCross = await post(
    "/api/children",
    { nickname: "Lintas Asal", age: 4 },
    "https://jahat.example",
  );
  check("create anak lintas-asal → 403", childCross.status === 403);

  const childDelete = await request("DELETE", `/api/children/${childId}`);
  console.log("arsip child:", childDelete.status, JSON.stringify(childDelete.body));
  check(
    "DELETE profil anak 200 + archivedAt terisi",
    childDelete.status === 200 && Boolean(childDelete.body?.child?.archivedAt),
  );
  const childListAfter = await get("/api/children");
  check(
    "profil terarsip keluar dari daftar aktif",
    childListAfter.status === 200 && childListAfter.body?.children?.length === 0,
  );

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

  // --- rate limiting (VRD 3.9): 3 login sudah terpakai di atas, ke-4 = 429 ---
  const limited = await post("/api/auth/login", {
    email: "smoke@contoh.id",
    password: "salah-satu-99",
  });
  console.log("login dibatasi:", limited.status, JSON.stringify(limited.body));
  check(
    "login ke-4 → 429 RATE_LIMITED dengan retry-after",
    limited.status === 429 && limited.body?.error === "RATE_LIMITED",
  );
  const limitedRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: "smoke@contoh.id", password: "x" }),
  });
  check(
    "respons 429 membawa header retry-after",
    Number(limitedRes.headers.get("retry-after")) > 0,
  );
  // Klien lain (beda kunci) tidak ikut terblokir → pakai header anti-spoof
  // tidak bisa; bukti cukup dengan kuota endpoint terpisah: register tetap jalan.
  const afterLimitReg = await post("/api/auth/register", {
    email: "smoke-lain@contoh.id",
    displayName: "Lain Dua",
    password: "sand1-kuat-99",
  });
  check("kuota register terpisah tetap 201", afterLimitReg.status === 201);
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
