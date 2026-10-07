/**
 * VRD 11.14 — konten non-published tidak pernah muncul di feed produksi anak.
 *
 * Menguji: seluruh jalur baca yang dipakai layar anak (daftar feed per usia,
 * daftar per area, ambil-satu, rekomendasi berikutnya, kolam asesmen dasar)
 * hanya mengembalikan aktivitas berstatus PUBLISHED; endpoint sesi & jawaban
 * anak menolak aktivitas non-published dengan 404 tanpa menulis apa pun; serta
 * guard sumber agar setiap query `FROM activity` di jalur non-reviewer wajib
 * menyaring `review_status = 'PUBLISHED'`.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Harus disetel SEBELUM modul db diimpor.
process.env.PGLITE_MODE = "memory";

const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const db = await getDb();
const { registerParent } = await import("../src/lib/auth/accounts.ts");
const profiles = await import("../src/lib/children/profiles.ts");
const areasMod = await import("../src/lib/learning/areas-skills.ts");
const feed = await import("../src/lib/activity/api.ts");
const recommendation = await import("../src/lib/progress/recommendation.ts");
const baseline = await import("../src/lib/assessment/baseline.ts");
const sessions = await import("../src/lib/progress/sessions.ts");
const sessionStart = await import("../src/pages/api/session/start.ts");
const attemptApi = await import("../src/pages/api/activity/attempt.ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";
const NON_PUBLISHED = [
  "DRAFT",
  "HUMAN_REVIEW",
  "QA_APPROVED",
  "FLAGGED",
  "UNPUBLISHED",
] as const;

// ---------- fixture ----------

const areas = await areasMod.listLearningAreas(db);
const area = areas[0];
const skillId = randomUUID();
await db.query(
  `INSERT INTO skill (id, learning_area_id, code, title, age_min, age_max, difficulty)
   VALUES ($1::uuid, $2::uuid, $3, $4, 3, 7, 1)`,
  [skillId, area.areaId, `sk_${skillId.slice(0, 8)}`, `Skill feed ${skillId.slice(0, 4)}`],
);

const hiddenIds = new Map<string, string>(); // status → activityId
for (const status of NON_PUBLISHED) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type,
                           correct_answer, review_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'TAP_ANSWER', '{}'::jsonb, $5::content_review_status)`,
    [id, skillId, area.areaId, `Prompt tersembunyi ${status}`, status],
  );
  hiddenIds.set(status, id);
}

async function seedPublished(): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type,
                           correct_answer, review_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Prompt tayang', 'TAP_ANSWER', '{}'::jsonb, 'PUBLISHED')`,
    [id, skillId, area.areaId],
  );
  return id;
}

async function seedOptions(activityId: string): Promise<string> {
  await db.query(
    `INSERT INTO activity_option (activity_id, position, payload, is_correct)
     VALUES ($1::uuid, 0, $2, true), ($1::uuid, 1, $3, false)`,
    [
      activityId,
      JSON.stringify({ label: "Bintang" }),
      JSON.stringify({ label: "Bulan" }),
    ],
  );
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM activity_option WHERE activity_id = $1::uuid AND is_correct = true`,
    [activityId],
  );
  assert.equal(rows.rows.length, 1);
  return rows.rows[0].id;
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `draftfeed${seq}@contoh.id`,
    displayName: `DraftFeed ${seq}`,
    password: "sand1-kuat-99",
  });
  assert.ok(reg.ok);
  if (!reg.ok) throw new Error("registrasi uji gagal");
  return reg.value.parentId;
}

async function makeChild(parentId: string, age = 5): Promise<string> {
  const result = await profiles.createChildProfile(db, parentId, {
    nickname: `Anak ${randomUUID().slice(0, 6)}`,
    age,
  });
  assert.ok(result.ok);
  if (!result.ok) throw new Error("pembuatan profil anak gagal");
  return result.value.childId;
}

class FakeCookies {
  private map = new Map<string, string>();
  get(name: string): { value: string } | undefined {
    const value = this.map.get(name);
    return value === undefined ? undefined : { value };
  }
  set(name: string, value: string): void {
    this.map.set(name, value);
  }
  delete(name: string): void {
    this.map.delete(name);
  }
}

function makeContext(options: {
  parentId?: string;
  path: string;
  method?: string;
  body?: unknown;
}): {
  request: Request;
  url: URL;
  cookies: FakeCookies;
  locals: { parentSession?: { parentId: string; sessionId: string; expiresAt: Date } };
} {
  const method = options.method ?? "POST";
  const raw = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", ORIGIN);
  const request = new Request(`${ORIGIN}${options.path}`, { method, headers, body: raw });
  const locals: { parentSession?: { parentId: string; sessionId: string; expiresAt: Date } } = {};
  if (options.parentId !== undefined) {
    locals.parentSession = {
      parentId: options.parentId,
      sessionId: "sesi-uji",
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  return {
    request,
    url: new URL(`${ORIGIN}${options.path}`),
    cookies: new FakeCookies(),
    locals,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: unknown): Promise<Response> {
  return handler(ctx);
}

// ---------- 11.14 feed tertutup selama belum ada konten PUBLISHED ----------

test("11.14 semua jalur baca anak kosong selama hanya ada konten non-published", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);

  // Daftar feed per usia & per area tidak menyorongkan satu pun non-published.
  assert.equal((await feed.listPublishedActivitiesForAge(db, 5)).length, 0);
  assert.equal(
    (await feed.listPublishedActivitiesForAreaAndAge(db, area.areaId, 5)).length,
    0,
  );
  for (const [status, id] of hiddenIds) {
    assert.equal(
      await feed.getPublishedActivityById(db, id),
      null,
      `aktivitas ${status} tidak boleh terbaca layar anak`,
    );
  }

  // Kolam asesmen dasar (8.1) ikut kosong.
  assert.equal((await baseline.selectBaselineActivities(db, 5, "benih-ujian", 8)).length, 0);

  // Rekomendasi berikutnya (7.3) tidak punya kandidat.
  assert.equal(await recommendation.getNextRecommendation(db, childId, 5), null);
});

// ---------- 11.14 hanya PUBLISHED yang bocor ke permukaan anak ----------

let publishedId = "";

test("11.14 setelah dipublikasikan, hanya aktivitas PUBLISHED yang muncul", async () => {
  publishedId = await seedPublished();
  const hidden = new Set(hiddenIds.values());

  const forAge = await feed.listPublishedActivitiesForAge(db, 5);
  assert.ok(forAge.some((a) => a.activityId === publishedId), "aktivitas PUBLISHED harus tayang");
  assert.ok(
    forAge.every((a) => !hidden.has(a.activityId)),
    "daftar feed usia tidak boleh memuat status non-published",
  );

  const forArea = await feed.listPublishedActivitiesForAreaAndAge(db, area.areaId, 5);
  assert.ok(forArea.some((a) => a.activityId === publishedId));
  assert.ok(forArea.every((a) => !hidden.has(a.activityId)));

  const one = await feed.getPublishedActivityById(db, publishedId);
  assert.ok(one, "aktivitas PUBLISHED tetap terbaca");
  assert.equal(one.reviewStatus, "PUBLISHED");

  const pool = await baseline.selectBaselineActivities(db, 5, "benih-ujian", 8);
  assert.ok(pool.length > 0, "kolam asesmen dasar punya kandidat saat ada konten tayang");
  assert.ok(pool.every((a) => !hidden.has(a.activityId)));

  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const rec = await recommendation.getNextRecommendation(db, childId, 5);
  assert.ok(rec, "rekomendasi tersedia saat ada konten tayang");
  assert.equal(rec.activityId, publishedId, "rekomendasi hanya menunjuk aktivitas PUBLISHED");
});

// ---------- 11.14 endpoint sesi & jawaban anak ----------

test("11.14 endpoint sesi dan jawaban anak menolak aktivitas non-published (404, tanpa tulis)", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const draftId = hiddenIds.get("DRAFT")!;

  const beforeSessions = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM learning_session WHERE child_id = $1::uuid`,
    [childId],
  );

  // POST /api/session/start dengan DRAFT → 404, sesi tidak dibuat.
  const startDraft = await call(
    sessionStart.POST,
    makeContext({
      parentId,
      path: "/api/session/start",
      body: { childId, activityId: draftId, learningAreaId: area.areaId },
    }),
  );
  assert.equal(startDraft.status, 404);
  const afterStart = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM learning_session WHERE child_id = $1::uuid`,
    [childId],
  );
  assert.equal(afterStart.rows[0].count, beforeSessions.rows[0].count, "tidak ada sesi dari permintaan ditolak");

  // Kontrol positif: PUBLISHED → 201.
  const startPublished = await call(
    sessionStart.POST,
    makeContext({
      parentId,
      path: "/api/session/start",
      body: { childId, activityId: publishedId, learningAreaId: area.areaId },
    }),
  );
  assert.equal(startPublished.status, 201);
  const started = (await startPublished.json()) as { sessionId: string };
  const sessionId = started.sessionId;

  // POST /api/activity/attempt dengan DRAFT → 404, tanpa attempt tersimpan.
  const beforeAttempts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );
  const attemptDraft = await call(
    attemptApi.POST,
    makeContext({
      parentId,
      path: "/api/activity/attempt",
      body: { childId, activityId: draftId, sessionId, answer: "x" },
    }),
  );
  assert.equal(attemptDraft.status, 404);
  const afterAttempts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );
  assert.equal(afterAttempts.rows[0].count, beforeAttempts.rows[0].count);

  // Kontrol positif: jawaban PUBLISHED tersimpan (loop belajar tetap jalan).
  const correct = await seedOptions(publishedId);
  const attemptOk = await call(
    attemptApi.POST,
    makeContext({
      parentId,
      path: "/api/activity/attempt",
      body: { childId, activityId: publishedId, sessionId, answer: correct },
    }),
  );
  assert.equal(attemptOk.status, 201, `jawaban PUBLISHED harus diterima (dapat ${attemptOk.status})`);
});

// ---------- 11.14 guard sumber: query jalur non-reviewer wajib menyaring ----------

test("11.14 guard sumber: setiap query `FROM activity` non-reviewer menyaring PUBLISHED", () => {
  const root = new URL("../", import.meta.url).pathname;
  const offenders: string[] = [];
  const scan = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(root.length);
      if (/\/reviewer\//.test(rel) || /\/reviewer\.ts$/.test(rel)) continue;
      if (entry === "reviewer.ts") continue;
      if (entry.endsWith(".ts") || entry.endsWith(".astro")) {
        const source = readFileSync(full, "utf8");
        if (/\bFROM\s+activity\b/.test(source) && !source.includes("review_status = 'PUBLISHED'")) {
          offenders.push(rel);
        }
      } else if (!entry.includes(".")) {
        scan(full);
      }
    }
  };
  scan(join(root, "src/lib"));
  scan(join(root, "src/pages"));
  assert.deepEqual(offenders, [], `query activity tanpa filter PUBLISHED: ${offenders.join(", ")}`);
});
