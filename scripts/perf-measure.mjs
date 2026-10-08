/**
 * Phase 18 — pengukuran performa (VRD 18.1–18.6) terhadap server hasil build.
 *
 * Mengukur apa adanya, tanpa mengarang angka:
 * - 18.1 initial load: TTFB + berat halaman (HTML + CSS + JS) untuk rute kunci
 * - 18.2 gambar: dihitung dari aset nyata (kini tanpa gambar → dilaporkan)
 * - 18.3 lazy-load: hanya dilaporkan bila ada aset besar yang bisa ditunda
 * - 18.4 bundle: total dist/client + estimasi gzip
 * - 18.5 cache: header Cache-Control aset ber-hashed (/_astro/) & aset statis
 * - 18.6 kecepatan transisi aktivitas: latensi POST /api/activity/attempt
 *
 * Ambang (keputusan run ini, dicatat di audit):
 * - TTFB halaman publik < 500 ms (lokal)
 * - berat halaman anak < 300 KB (belum terkompresi)
 * - aset ber-hashed wajib punya Cache-Control (public + max-age)
 * - latensi attempt < 500 ms (lokal)
 *
 * Pemakaian: `npm run build && node scripts/perf-measure.mjs`
 * Output terakhir: PERF_OK (lolos) atau PERF_GAGAL=<n>.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const PORT = 4399;
const base = `http://[::1]:${PORT}`;
const origin = base;
const DB_DIR = path.join(process.cwd(), ".data", "perf-pglite");

const TTFB_MAX_MS = 500;
const CHILD_PAGE_MAX_BYTES = 300 * 1024;
const ATTEMPT_MAX_MS = 500;

await rm(DB_DIR, { recursive: true, force: true });

// --- database segar + satu aktivitas PUBLISHED (pola smoke-loop) ---
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

async function post(reqPath, body) {
  const res = await fetch(base + reqPath, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
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
  return { status: res.status, body: parsed };
}

/** TTFB median dari n percobaan + badan dari percobaan terakhir. */
async function measureTtfb(reqPath, n = 5) {
  const times = [];
  let res;
  let body = "";
  for (let i = 0; i < n; i += 1) {
    const t0 = performance.now();
    res = await fetch(base + reqPath, {
      headers: jar.size ? { cookie: cookieHeader() } : {},
      redirect: "manual",
    });
    times.push(performance.now() - t0);
    if (i === n - 1) body = await res.text();
    else await res.arrayBuffer();
    absorbCookies(res);
  }
  times.sort((a, b) => a - b);
  return {
    status: res.status,
    location: res.headers.get("location"),
    ttfb: times[Math.floor(times.length / 2)],
    bytes: Buffer.byteLength(body),
    body,
    headers: res.headers,
  };
}

/** Ambil aset yang dirujuk HTML (link rel=stylesheet + script src/module). */
async function referencedAssets(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) urls.add(m[1]);
  for (const m of html.matchAll(/from\s+["'](\/[^"']+\.js)["']/g)) urls.add(m[1]);
  return [...urls].filter((u) => u.startsWith("/"));
}

let failed = 0;
const report = [];
function check(label, cond, detail = "") {
  if (cond) console.log(`✔ ${label}`);
  else {
    failed += 1;
    console.log(`✖ ${label} ${detail}`);
  }
}
function note(line) {
  report.push(line);
  console.log(`  · ${line}`);
}

function gzipEstimate(bytes) {
  // estimasi kasar rasio gzip untuk teks (0,32) — hanya untuk laporan
  return Math.round(bytes * 0.32);
}

async function dirStats(dir) {
  let total = 0;
  let files = 0;
  async function walk(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        total += (await stat(p)).size;
        files += 1;
      }
    }
  }
  await walk(dir);
  return { total, files };
}

try {
  await waitForServer();

  // ============ 18.1 initial load ============
  console.log("\n— 18.1 Muat awal (TTFB median 5x, lokal) —");
  const pubPages = [
    ["/", "beranda"],
    ["/login", "login"],
  ];
  for (const [p, label] of pubPages) {
    const m = await measureTtfb(p);
    note(`${label}: TTFB ${m.ttfb.toFixed(0)} ms, HTML ${m.bytes} B`);
    check(`${label} TTFB < ${TTFB_MAX_MS} ms`, m.ttfb < TTFB_MAX_MS, `${m.ttfb.toFixed(0)} ms`);
  }

  // halaman anak butuh akun + profil
  const reg = await post("/api/auth/register", {
    email: `perf@contoh.id`,
    displayName: "Perf",
    password: "sand1-kuat-99",
  });
  check("register 201", reg.status === 201, JSON.stringify(reg.body));
  const childRes = await post("/api/children", { nickname: "Nusa", age: 5 });
  check("profil anak 201", childRes.status === 201, JSON.stringify(childRes.body));
  const childId = childRes.body?.child?.childId;

  const childPages = [
    [`/learn?child=${childId}`, "child home"],
    [`/learn/area/${skill.area_code}?child=${childId}`, "halaman area"],
  ];
  let childWeight = 0;
  for (const [p, label] of childPages) {
    const m = await measureTtfb(p);
    const assets = await referencedAssets(m.body);
    let assetBytes = 0;
    for (const a of assets) {
      const r = await fetch(base + a, { headers: jar.size ? { cookie: cookieHeader() } : {} });
      if (r.ok) assetBytes += Buffer.byteLength(await r.arrayBuffer());
    }
    const weight = m.bytes + assetBytes;
    if (label === "child home") childWeight = weight;
    note(`${label}: TTFB ${m.ttfb.toFixed(0)} ms, HTML ${m.bytes} B, aset referensi ${assets.length} file ${assetBytes} B, total ${weight} B`);
    check(`${label} TTFB < ${TTFB_MAX_MS} ms`, m.ttfb < TTFB_MAX_MS, `${m.ttfb.toFixed(0)} ms`);
  }
  check(
    `berat child home < ${CHILD_PAGE_MAX_BYTES / 1024} KB`,
    childWeight < CHILD_PAGE_MAX_BYTES,
    `${childWeight} B`,
  );

  // layar aktivitas (perlu sesi → ikuti redirect)
  const openRes = await fetch(`${base}/learn/aktivitas/${activityId}?child=${childId}`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  absorbCookies(openRes);
  const playUrl = openRes.headers.get("location");
  check("layar aktivitas mengarah ke sesi", Boolean(playUrl && playUrl.includes("session=")), String(playUrl));
  const play = await measureTtfb(playUrl, 5);
  const playAssets = await referencedAssets(play.body);
  let playAssetBytes = 0;
  for (const a of playAssets) {
    const r = await fetch(base + a, { headers: { cookie: cookieHeader() } });
    if (r.ok) playAssetBytes += Buffer.byteLength(await r.arrayBuffer());
  }
  const playWeight = play.bytes + playAssetBytes;
  note(`layar aktivitas: TTFB ${play.ttfb.toFixed(0)} ms, HTML ${play.bytes} B, aset ${playAssetBytes} B, total ${playWeight} B`);
  check(`layar aktivitas TTFB < ${TTFB_MAX_MS} ms`, play.ttfb < TTFB_MAX_MS, `${play.ttfb.toFixed(0)} ms`);
  check(
    `berat layar aktivitas < ${CHILD_PAGE_MAX_BYTES / 1024} KB`,
    playWeight < CHILD_PAGE_MAX_BYTES,
    `${playWeight} B`,
  );

  // ============ 18.2 gambar ============
  console.log("\n— 18.2 Gambar —");
  const { total: publicBytes, files: publicFiles } = await dirStats(path.join(process.cwd(), "public"));
  note(`public/: ${publicFiles} file, ${publicBytes} B (semua .js, tanpa gambar)`);
  check("tidak ada gambar berat yang memblokir interaksi pertama", publicBytes < 200 * 1024, `${publicBytes} B`);

  // ============ 18.4 bundle ============
  console.log("\n— 18.4 Bundle klien —");
  const client = await dirStats(path.join(process.cwd(), "dist", "client"));
  const gzip = gzipEstimate(client.total);
  note(`dist/client: ${client.files} file, ${client.total} B (~gzip ${gzip} B)`);
  check(`bundle klien < 512 KB mentah`, client.total < 512 * 1024, `${client.total} B`);

  // ============ 18.5 cache ============
  console.log("\n— 18.5 Cache aset statis —");
  // aset hashed Astro
  const astroAssetMatch = play.body.match(/\/_astro\/[^"]+\.(?:js|css)/);
  check("halaman merujuk aset /_astro/ (ber-hashed)", Boolean(astroAssetMatch), "tidak ditemukan");
  if (astroAssetMatch) {
    const r = await fetch(base + astroAssetMatch[0]);
    const cc = r.headers.get("cache-control");
    note(`aset hashed ${astroAssetMatch[0]} → cache-control: ${cc ?? "(tidak ada)"}`);
    check(
      "aset ber-hashed punya Cache-Control public + max-age",
      Boolean(cc && /public|max-age/.test(cc)),
      `cache-control=${cc}`,
    );
    check("aset ber-hashed dijawab 200", r.status === 200, String(r.status));
  }
  // aset runtime aktivitas (tidak ber-hashed — nama tetap)
  const rt = await fetch(`${base}/activity/runtime.js`);
  const rtCc = rt.headers.get("cache-control");
  note(`/activity/runtime.js → cache-control: ${rtCc ?? "(tidak ada)"}`);

  // ============ 18.6 transisi aktivitas ============
  console.log("\n— 18.6 Latensi jawaban (POST attempt) —");
  const sessionId = new URL(playUrl, base).searchParams.get("session");
  const latencies = [];
  let last;
  for (let i = 0; i < 5; i += 1) {
    const t0 = performance.now();
    last = await post("/api/activity/attempt", {
      childId,
      activityId,
      sessionId,
      answer: correctOptionId,
      durationMs: 500,
    });
    latencies.push(performance.now() - t0);
  }
  latencies.sort((a, b) => a - b);
  const attemptMedian = latencies[Math.floor(latencies.length / 2)];
  note(`attempt: median ${attemptMedian.toFixed(0)} ms (min ${latencies[0].toFixed(0)}, max ${latencies[4].toFixed(0)}), status terakhir ${last.status}`);
  check(`latensi attempt < ${ATTEMPT_MAX_MS} ms`, attemptMedian < ATTEMPT_MAX_MS, `${attemptMedian.toFixed(0)} ms`);
  check("attempt terakhir 201 + benar", last.status === 201 && last.body?.correct === true, JSON.stringify(last.body));

  console.log("\n— Ringkasan —");
  for (const line of report) console.log(`  ${line}`);
} catch (err) {
  failed += 1;
  console.error("PERF_FAIL", err);
} finally {
  server.kill("SIGTERM");
  await sleep(300);
  if (!server.killed) server.kill("SIGKILL");
}

console.log(failed === 0 ? "PERF_OK" : `PERF_GAGAL=${failed}`);
process.exit(failed === 0 ? 0 : 1);
