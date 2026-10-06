/**
 * Smoke test E2E learning loop (VRD 7.5–7.7).
 *
 * Alur nyata lewat HTTP terhadap server hasil `npm run build`:
 * anak memilih area → membuka aktivitas (sesi dibuka) → menjawab (dinilai
 * server) → umpan balik → sesi ditutup. Database segar tiap run; satu
 * aktivitas PUBLISHED ditanam lebih dulu supaya loop benar-benar terbukti
 * jalan (bukan layar kosong).
 *
 * Pemakaian: `npm run build && node scripts/smoke-loop.mjs`
 * Output terakhir: SMOKE_LOOP_OK (lulus) atau SMOKE_LOOP_GAGAL=<n>.
 * Folder database masuk .gitignore (.data/).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

const PORT = 4398;
const base = `http://[::1]:${PORT}`;
const origin = base;
const DB_DIR = path.join(process.cwd(), ".data", "smoke-loop-pglite");

await rm(DB_DIR, { recursive: true, force: true });

// --- tanam satu aktivitas PUBLISHED di database segar sebelum server start ---
process.env.PGLITE_DIR = DB_DIR;
const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const db = await getDb();
const skillRow = await db.query(
  `SELECT s.id AS skill_id, s.learning_area_id, la.code AS area_code
     FROM skill s JOIN learning_area la ON la.id = s.learning_area_id
    ORDER BY la.sort_order, s.sort_order LIMIT 1`,
);
if (skillRow.rows.length === 0) throw new Error("seed skill (migrasi 0003) tidak ada");
const skill = skillRow.rows[0];
const activityId = randomUUID();
await db.query(
  `INSERT INTO activity (id, skill_id, learning_area_id, target_age_min, target_age_max,
                         difficulty, prompt, interaction_type, correct_answer, review_status)
   VALUES ($1::uuid, $2::uuid, $3::uuid, 3, 7, 1, 'Manakah yang benar?', 'TAP_ANSWER', '{}'::jsonb, 'PUBLISHED')`,
  [activityId, skill.skill_id, skill.learning_area_id],
);
await db.query(
  `INSERT INTO activity_option (activity_id, position, payload, is_correct)
   VALUES ($1::uuid, 0, $2, true), ($1::uuid, 1, $3, false)`,
  [activityId, JSON.stringify({ label: "Bintang" }), JSON.stringify({ label: "Bulan" })],
);
const optionRows = await db.query(
  `SELECT id, is_correct FROM activity_option WHERE activity_id = $1::uuid ORDER BY position`,
  [activityId],
);
const correctOptionId = optionRows.rows[0].id;
const wrongOptionId = optionRows.rows[1].id;
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
    if (v === "" || /expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k);
    else jar.set(k, v);
  }
}
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

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
  return { status: res.status, body: parsed, location: res.headers.get("location") };
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

try {
  await waitForServer();

  // --- rute anak dilindungi sesi (VRD 3.5) sebelum masuk akun ---
  const anonLearn = await getRaw(`/learn?child=${randomUUID()}`);
  check(
    "/learn tanpa sesi → 303 ke /login",
    anonLearn.status === 303 && String(anonLearn.location).endsWith("/login"),
    `status=${anonLearn.status} loc=${anonLearn.location}`,
  );
  const anonAttempt = await fetch(`${base}/api/activity/attempt`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({}),
  });
  check("endpoint percobaan tanpa sesi → 401", anonAttempt.status === 401, String(anonAttempt.status));

  // --- akun + profil anak ---
  const reg = await request("POST", "/api/auth/register", {
    email: "loop@contoh.id",
    displayName: "Loop",
    password: "sand1-kuat-99",
  });
  check("register 201", reg.status === 201, JSON.stringify(reg.body));
  const childRes = await request("POST", "/api/children", { nickname: "Nusa", age: 5 });
  check("profil anak 201", childRes.status === 201, JSON.stringify(childRes.body));
  const childId = childRes.body?.child?.childId;
  check("childId terbentuk", typeof childId === "string");

  // --- 7.5 halaman detail area ---
  const learn = await getRaw(`/learn?child=${childId}`);
  check(
    "/learn 200 dan menautkan halaman area",
    learn.status === 200 && learn.body.includes("/learn/area/"),
    `status=${learn.status}`,
  );

  const area = await getRaw(`/learn/area/${skill.area_code}?child=${childId}`);
  check(
    "halaman area 200 + memuat aktivitas + tombol Mulai",
    area.status === 200 &&
      area.body.includes("Manakah yang benar?") &&
      area.body.includes(`/learn/aktivitas/${activityId}?child=`),
    `status=${area.status}`,
  );

  const unknownArea = await getRaw(`/learn/area/tidak-ada?child=${childId}`);
  check(
    "area tak dikenal → kembali ke /learn (anti-enumerasi)",
    [302, 303].includes(unknownArea.status) &&
      String(unknownArea.location).startsWith("/learn?child="),
    `status=${unknownArea.status} loc=${unknownArea.location}`,
  );

  const noSessionPage = await getRaw(`/learn/area/${skill.area_code}?child=${randomUUID()}`);
  check(
    "profil anak asing → dialihkan, tidak dirender",
    [302, 303].includes(noSessionPage.status) && String(noSessionPage.location).endsWith("/parent"),
    `status=${noSessionPage.status} loc=${noSessionPage.location}`,
  );

  // --- 7.6 membuka layar aktivitas → sesi dibuka ---
  const openNoSession = await getRaw(`/learn/aktivitas/${activityId}?child=${childId}`);
  check(
    "buka aktivitas tanpa sesi → diarahkan membawa id sesi",
    [302, 303].includes(openNoSession.status) &&
      String(openNoSession.location).includes("session="),
    `status=${openNoSession.status} loc=${openNoSession.location}`,
  );

  const playUrl = String(openNoSession.location);
  const sessionId = new URL(playUrl, base).searchParams.get("session");
  check("id sesi terbentuk", typeof sessionId === "string" && sessionId.length > 0);

  const play = await getRaw(playUrl);
  check(
    "layar aktivitas 200 + renderer + konfigurasi sesi",
    play.status === 200 &&
      play.body.includes('class="activity-root') &&
      play.body.includes('id="activity-config"') &&
      play.body.includes("/activity/runtime.js"),
    `status=${play.status}`,
  );

  const refresh = await getRaw(playUrl);
  check(
    "muat ulang layar aktivitas tidak membuat sesi baru (id sama)",
    refresh.status === 200 && refresh.body.includes(`"sessionId":"${sessionId}"`),
    `status=${refresh.status}`,
  );

  // --- 7.6/7.7 menjawab → dinilai server → progres naik ---
  const wrong = await request("POST", "/api/activity/attempt", {
    childId,
    activityId,
    sessionId,
    answer: wrongOptionId,
    isCorrect: true, // klaim klien tidak dipercaya
  });
  check("jawaban salah → 201 dengan correct:false", wrong.status === 201 && wrong.body?.correct === false, JSON.stringify(wrong.body));
  check("umpan balik memakai bahasa netral", typeof wrong.body?.explanation === "string" && wrong.body.explanation.length > 0);

  const right = await request("POST", "/api/activity/attempt", {
    childId,
    activityId,
    sessionId,
    answer: correctOptionId,
    durationMs: 1200,
  });
  check(
    "jawaban benar → 201 correct:true + attempt_no naik",
    right.status === 201 && right.body?.correct === true && right.body?.attemptNo === 2,
    JSON.stringify(right.body),
  );

  const badSession = await request("POST", "/api/activity/attempt", {
    childId,
    activityId,
    sessionId: randomUUID(),
    answer: correctOptionId,
  });
  check("sesi tidak dikenal → 400", badSession.status === 400, String(badSession.status));

  // --- lintas asal ---

  const cross = await request(
    "POST",
    "/api/session/complete",
    { sessionId, childId },
    "https://contoh-licik.example",
  );
  check("lintas-asal ditolak 403", cross.status === 403, String(cross.status));

  // --- 7.7 sesi ditutup idempoten ---
  const done = await request("POST", "/api/session/complete", { sessionId, childId });
  check("sesi selesai → 200 + endedAt", done.status === 200 && Boolean(done.body?.endedAt), JSON.stringify(done.body));
  const again = await request("POST", "/api/session/complete", { sessionId, childId });
  check("tutup ulang idempoten + balasan sama", again.status === 200 && JSON.stringify(again.body) === JSON.stringify(done.body));

  // --- layar aktivitas tidak dikenal → kembali ke beranda belajar ---
  const ghost = await getRaw(`/learn/aktivitas/${randomUUID()}?child=${childId}`);
  check(
    "aktivitas tak dikenal → kembali ke /learn",
    [302, 303].includes(ghost.status) && String(ghost.location).startsWith("/learn?child="),
    `status=${ghost.status} loc=${ghost.location}`,
  );

  // --- tanpa JavaScript pun tidak ada layar buntu: tautan kembali tersedia ---
  const backLink = await getRaw(`/learn/area/${skill.area_code}?child=${childId}`);
  check("halaman area punya tautan kembali ke /learn", backLink.body.includes(`/learn?child=${childId}`));
} catch (err) {
  failed += 1;
  console.error("SMOKE_LOOP_FAIL", err);
} finally {
  server.kill("SIGTERM");
  await sleep(300);
  if (!server.killed) server.kill("SIGKILL");
}

console.log(failed === 0 ? "SMOKE_LOOP_OK" : `SMOKE_LOOP_GAGAL=${failed}`);
process.exit(failed === 0 ? 0 : 1);
