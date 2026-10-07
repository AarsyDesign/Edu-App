/**
 * Smoke test E2E alur review konten (VRD Phase 11.11–11.13).
 *
 * Menjalankan server hasil `npm run build` dengan database segar, masuk sebagai
 * reviewer sungguhan lewat HTTP, lalu membuktikan matriks transisi PRD §7:
 * tidak ada jalan pintas ke PUBLISHED (harus lewat HUMAN_REVIEW → QA_APPROVED),
 * setiap transisi tercatat di `content_review` (riwayat tampil di layar), dan
 * konten terbit tetap terkunci untuk diedit sampai ditarik.
 *
 * Pemakaian: `npm run build && node scripts/smoke-reviewer.mjs`
 * Output terakhir: SMOKE_REVIEWER_OK (lulus) atau SMOKE_REVIEWER_GAGAL=<n>.
 * Folder database masuk .gitignore (.data/).
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

const PORT = 4401;
// Adapter node hanya mem-bind localhost (IPv6 ::1); Node fetch tidak ikut
// happy eyeballs ke 127.0.0.1, jadi alamat eksplisit dipakai di sini.
const base = `http://[::1]:${PORT}`;
const origin = base;
const DB_DIR = path.join(process.cwd(), ".data", "smoke-reviewer-pglite");

await rm(DB_DIR, { recursive: true, force: true });

// --- tanam akun reviewer + satu skill acuan di database segar ---
process.env.PGLITE_DIR = DB_DIR;
const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const { hashReviewerPassword } = await import("../src/lib/auth/reviewer.ts");
const db = await getDb();

const skillRow = await db.query(
  `SELECT s.id AS skill_id, s.learning_area_id
     FROM skill s JOIN learning_area la ON la.id = s.learning_area_id
    ORDER BY la.sort_order, s.sort_order LIMIT 1`,
);
if (skillRow.rows.length === 0) throw new Error("seed skill (migrasi 0003) tidak ada");
const skill = skillRow.rows[0];

// Kata sandi fixture: nama samaran, hanya untuk server localhost ini.
await db.query(
  `INSERT INTO reviewer_account (email, display_name, role, password_hash)
   VALUES ($1, $2, 'REVIEWER', $3)`,
  ["peninjau@contoh.test", "Peninjau Smoke", await hashReviewerPassword("sandi-uji-99")],
);
await closeDb();

// --- jalankan server build ---
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
    if (v === "" || /expires=Thu, 01 Jan 1970/i.test(v)) jar.delete(k);
    else jar.set(k, { value: v, raw: c });
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, e]) => `${k}=${e.value}`).join("; ");

async function request(method, reqPath, body, overrideOrigin = origin) {
  const res = await fetch(base + reqPath, {
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
  return { status: res.status, body: parsed };
}

const post = (reqPath, body, overrideOrigin) =>
  request("POST", reqPath, body, overrideOrigin);

async function get(reqPath) {
  const res = await fetch(base + reqPath, {
    headers: jar.size ? { cookie: cookieHeader() } : {},
  });
  absorbCookies(res);
  return { status: res.status, body: await res.json() };
}

async function getRaw(reqPath) {
  const res = await fetch(base + reqPath, {
    headers: jar.size ? { cookie: cookieHeader() } : {},
    redirect: "manual",
  });
  absorbCookies(res);
  return { status: res.status, location: res.headers.get("location"), body: await res.text() };
}

let failed = 0;
function check(label, cond, detail = "") {
  if (cond) console.log(`✔ ${label}`);
  else {
    failed += 1;
    console.log(`✖ ${label} ${detail}`);
  }
}

const activityPayload = {
  prompt: "Mana yang berwarna merah?",
  interaction_type: "TAP_ANSWER",
  learning_area_id: skill.learning_area_id,
  skill_id: skill.skill_id,
  target_age_min: 3,
  target_age_max: 7,
  difficulty: 1,
  correct_answer: {
    type: "tap_answer",
    items: [
      { id: "opt-1", label: "Apel", isCorrect: true },
      { id: "opt-2", label: "Pisang", isCorrect: false },
    ],
  },
  explanation: "Apel berwarna merah.",
  content_origin: "HUMAN_CREATED",
  sources: [],
};

try {
  await waitForServer();

  // --- gerbang sesi (VRD 11.1) sebelum login ---
  const anonPage = await getRaw("/reviewer/aktivitas");
  check(
    "/reviewer/aktivitas tanpa sesi → 303 ke /reviewer/login",
    anonPage.status === 303 && String(anonPage.location).endsWith("/reviewer/login"),
    `${anonPage.status} ${anonPage.location}`,
  );
  const anonStatus = await post("/api/reviewer/aktivitas/00000000-0000-4000-8000-000000000000/status", {
    to_status: "HUMAN_REVIEW",
  });
  check("POST status tanpa sesi → 401", anonStatus.status === 401, JSON.stringify(anonStatus.body));
  const loginPage = await getRaw("/reviewer/login");
  check("/reviewer/login publik → 200", loginPage.status === 200);

  // --- login reviewer ---
  const login = await post("/api/reviewer/auth/login", {
    email: "peninjau@contoh.test",
    password: "sandi-uji-99",
  });
  console.log("login reviewer:", login.status, JSON.stringify(login.body));
  check("login reviewer 200 + sesi terpasang", login.status === 200 && jar.has("edu_reviewer_session"));

  const dash = await getRaw("/reviewer/aktivitas");
  check("daftar aktivitas dengan sesi → 200", dash.status === 200);

  // --- buat draf lewat editor ---
  const created = await post("/api/reviewer/aktivitas", activityPayload);
  console.log("buat aktivitas:", created.status, JSON.stringify(created.body));
  check("buat aktivitas 200 + status DRAFT", created.status === 200 && created.body?.reviewStatus === "DRAFT");
  const activityId = created.body?.activityId;
  if (typeof activityId !== "string") throw new Error("activityId tidak ada");

  const detail0 = await get(`/api/reviewer/aktivitas/${activityId}`);
  check(
    "detail awal: riwayat kosong",
    detail0.status === 200 && Array.isArray(detail0.body.history) && detail0.body.history.length === 0,
  );

  // --- matriks transisi (VRD 11.11 / 11.13) ---
  const bypass = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "PUBLISHED" });
  console.log("loncat ke PUBLISHED:", bypass.status, JSON.stringify(bypass.body));
  check(
    "DRAFT → PUBLISHED ditolak 409 INVALID_TRANSITION",
    bypass.status === 409 && bypass.body?.error === "INVALID_TRANSITION",
    JSON.stringify(bypass.body),
  );

  const step1 = await post(`/api/reviewer/aktivitas/${activityId}/status`, {
    to_status: "HUMAN_REVIEW",
    notes: "siap diperiksa",
  });
  check("DRAFT → HUMAN_REVIEW 200", step1.status === 200, JSON.stringify(step1.body));

  const skipQa = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "PUBLISHED" });
  check("HUMAN_REVIEW → PUBLISHED ditolak 409", skipQa.status === 409, JSON.stringify(skipQa.body));

  const step2 = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "QA_APPROVED" });
  check("HUMAN_REVIEW → QA_APPROVED 200", step2.status === 200, JSON.stringify(step2.body));

  const step3 = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "PUBLISHED" });
  check("QA_APPROVED → PUBLISHED 200", step3.status === 200, JSON.stringify(step3.body));

  const detail1 = await get(`/api/reviewer/aktivitas/${activityId}`);
  const history = detail1.body?.history ?? [];
  console.log("riwayat:", JSON.stringify(history.map((h) => `${h.fromStatus}->${h.toStatus}`)));
  check("riwayat berisi 3 transisi", history.length === 3, String(history.length));
  check(
    "riwayat membawa nama reviewer + catatan",
    history.every((h) => h.reviewerName === "Peninjau Smoke") &&
      history.some((h) => h.notes === "siap diperiksa"),
    JSON.stringify(history[0]),
  );

  // --- konten terbit terkunci untuk diedit (OQ 24) ---
  const editLocked = await request("PUT", `/api/reviewer/aktivitas/${activityId}`, {
    ...activityPayload,
    prompt: "Diedit diam-diam?",
  });
  check("edit saat PUBLISHED → 409 STATUS_LOCKED", editLocked.status === 409, JSON.stringify(editLocked.body));

  // --- jalur perbaikan: tarik → edit → review lagi → terbit ---
  const unpublish = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "UNPUBLISHED" });
  check("PUBLISHED → UNPUBLISHED 200", unpublish.status === 200, JSON.stringify(unpublish.body));

  const editOk = await request("PUT", `/api/reviewer/aktivitas/${activityId}`, {
    ...activityPayload,
    prompt: "Diperbaiki setelah ditinjau?",
  });
  check("edit setelah ditarik → 200", editOk.status === 200, JSON.stringify(editOk.body));

  const resubmit = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "HUMAN_REVIEW" });
  check("UNPUBLISHED → HUMAN_REVIEW 200", resubmit.status === 200, JSON.stringify(resubmit.body));

  const jumpAgain = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "PUBLISHED" });
  check("loncat QA kedua tetap ditolak", jumpAgain.status === 409);

  // --- penolakan input & lintas asal ---
  const badStatus = await post(`/api/reviewer/aktivitas/${activityId}/status`, { to_status: "LIVE_NOW" });
  check("status tak dikenal → 400", badStatus.status === 400, JSON.stringify(badStatus.body));

  const longNotes = await post(`/api/reviewer/aktivitas/${activityId}/status`, {
    to_status: "QA_APPROVED",
    notes: "x".repeat(2001),
  });
  check("catatan >2000 karakter → 400", longNotes.status === 400, JSON.stringify(longNotes.body));

  const cross = await post(
    `/api/reviewer/aktivitas/${activityId}/status`,
    { to_status: "QA_APPROVED" },
    "https://jahat.example",
  );
  check("transisi lintas-asal → 403", cross.status === 403, JSON.stringify(cross.body));

  // --- layar detail (VRD 11.11 UI) ---
  const page = await getRaw(`/reviewer/aktivitas/${activityId}`);
  console.log("halaman detail:", page.status);
  check(
    "layar detail 200 + panel Alur review + riwayat teks",
    page.status === 200 &&
      page.body.includes("Alur review") &&
      page.body.includes("Riwayat review") &&
      page.body.includes("Menunggu review") &&
      page.body.includes("data-review-flow"),
  );
} catch (err) {
  failed += 1;
  console.error("SMOKE_FAIL", err);
} finally {
  server.kill("SIGTERM");
  await sleep(300);
  if (!server.killed) server.kill("SIGKILL");
}

console.log(failed === 0 ? "SMOKE_REVIEWER_OK" : `SMOKE_REVIEWER_GAGAL=${failed}`);
process.exit(failed === 0 ? 0 : 1);
