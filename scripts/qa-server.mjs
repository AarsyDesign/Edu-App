/**
 * QA server — server hasil build + database segar untuk QA E2E eksploratif
 * di peramban (VRD 16.10/16.11 viewport, 17.1/17.13 tinjauan visual).
 *
 * Berbeda dari smoke: skrip ini TIDAK mengakhiri server — ia berjalan sampai
 * dihentikan supaya peramban QA bisa membuka beberapa layar berturut-turut.
 *
 * Isi awal database segar:
 *   - satu akun reviewer (fixture nama samaran, hanya untuk server localhost)
 *   - dua aktivitas: satu DRAFT, satu PUBLISHED (lewat matriks PRD §7)
 *
 * Pemakaiannya:
 *   npm run build && node scripts/qa-server.mjs
 *   → baris terakhir: QA_SERVER_READY (port, cookie, id aktivitas)
 *   → hentikan dengan Ctrl+C / kill.
 *
 * Env: QA_PORT (default 4403), PGLITE_DIR (default .data/qa-server-pglite).
 */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.QA_PORT ?? 4403);
const origin = `http://127.0.0.1:${PORT}`;
const DB_DIR = path.join(process.cwd(), ".data", "qa-server-pglite");

await rm(DB_DIR, { recursive: true, force: true });

// --- siapkan database segar: reviewer + skill acuan -------------------------
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
  [
    "peninjau@contoh.test",
    "Peninjau QA",
    await hashReviewerPassword("sandi-uji-99"),
  ],
);
await closeDb();

// --- jalankan server hasil build -------------------------------------------
const server = spawn("node", ["./dist/server/entry.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    PGLITE_DIR: DB_DIR,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
server.stderr.on("data", (d) => process.stdout.write(`[srv-err] ${d}`));
process.on("exit", () => server.kill("SIGTERM"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i += 1) {
  try {
    const res = await fetch(`${origin}/`);
    if (res.ok) break;
  } catch {
    /* belum siap */
  }
  if (i === 59) throw new Error("server tidak siap");
  await sleep(500);
}

// --- login reviewer + tanam aktivitas contoh lewat API sungguhan ------------
const jar = new Map();
function absorbCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1);
    if (v === "" || /expires=Thu, 01 Jan 1970/i.test(v)) jar.delete(k);
    else jar.set(k, v);
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function call(method, reqPath, body) {
  const res = await fetch(origin + reqPath, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
      ...(jar.size ? { cookie: cookieHeader() } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: "manual",
  });
  absorbCookies(res);
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

const login = await call("POST", "/api/reviewer/auth/login", {
  email: "peninjau@contoh.test",
  password: "sandi-uji-99",
});
if (login.status !== 200 || !jar.has("edu_reviewer_session")) {
  throw new Error(`login reviewer gagal: ${login.status} ${JSON.stringify(login.body)}`);
}

const basePayload = {
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

const draft = await call("POST", "/api/reviewer/aktivitas", basePayload);
if (draft.status !== 200) throw new Error(`buat draf gagal: ${JSON.stringify(draft.body)}`);

const publishedDraft = await call("POST", "/api/reviewer/aktivitas", {
  ...basePayload,
  prompt: "Benar atau salah: langit di atas kita.",
  interaction_type: "TRUE_FALSE",
  correct_answer: {
    type: "true_false",
    statement: "Langit berada di atas kita.",
    correctAnswer: true,
  },
  explanation: "Langit memang berada di atas kita.",
});
if (publishedDraft.status !== 200) {
  throw new Error(`buat draf kedua gagal: ${JSON.stringify(publishedDraft.body)}`);
}
const publishedId = publishedDraft.body.activityId;
for (const to of ["HUMAN_REVIEW", "QA_APPROVED", "PUBLISHED"]) {
  const step = await call("POST", `/api/reviewer/aktivitas/${publishedId}/status`, {
    to_status: to,
  });
  if (step.status !== 200) {
    throw new Error(`transisi ${to} gagal: ${JSON.stringify(step.body)}`);
  }
}

console.log(
  [
    "QA_SERVER_READY",
    `port=${PORT}`,
    `origin=${origin}`,
    `cookie=${cookieHeader()}`,
    `draftId=${draft.body.activityId}`,
    `publishedId=${publishedId}`,
    `db=${DB_DIR}`,
  ].join(" "),
);

// Server tetap hidup sampai proses dihentikan.
await new Promise(() => {});
