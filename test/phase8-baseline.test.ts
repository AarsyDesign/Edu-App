/**
 * Baseline Assessment (VRD Phase 8, item 8.1–8.8) — mesin + endpoint.
 *
 * Menguji: usia menentukan kolam awal (8.1), pengacakan dalam band kesukaran
 * terkendali + deterministik per anak (8.2), penyimpanan percobaan (8.3),
 * estimasi kemampuan per skill (8.4), rekomendasi titik mulai (8.5),
 * tanpa label lulus/gagal (8.6), memulai ulang oleh orang tua (8.7),
 * serta asesmen tetap pendek 5–10 aktivitas (8.8) + perilaku endpoint.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const db = await (async () => {
  const mod = await import("../src/lib/db/index.ts");
  return mod.getDb();
})();
const { closeDb } = await import("../src/lib/db/index.ts");
const { registerParent } = await import("../src/lib/auth/accounts.ts");
const profiles = await import("../src/lib/children/profiles.ts");
const areas = await import("../src/lib/learning/areas-skills.ts");
const engine = await import("../src/lib/assessment/baseline.ts");
const api = await import("../src/pages/api/assessment/baseline.ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";

// ---------- helper seed ----------

async function seedSkill(
  areaCode: string,
  opts: { ageMin?: number; ageMax?: number; difficulty?: number } = {},
): Promise<{ skillId: string; areaId: string }> {
  const area = await areas.getLearningAreaByCode(db, areaCode);
  assert.ok(area, `area ${areaCode} harus ada dari migrasi 0003`);
  const skillId = randomUUID();
  await db.query(
    `INSERT INTO skill (id, learning_area_id, code, title, age_min, age_max, difficulty)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`,
    [
      skillId,
      area!.areaId,
      `sk_${skillId.slice(0, 8)}`,
      `Skill ${skillId.slice(0, 4)}`,
      opts.ageMin ?? 3,
      opts.ageMax ?? 7,
      opts.difficulty ?? 1,
    ],
  );
  return { skillId, areaId: area!.areaId };
}

async function seedActivity(
  skill: { skillId: string; areaId: string },
  opts: {
    ageMin?: number;
    ageMax?: number;
    difficulty?: number;
    status?: string;
    prompt?: string;
  } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, target_age_min, target_age_max,
                           difficulty, prompt, interaction_type, correct_answer, review_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, 'TAP_ANSWER', '{"ok":1}'::jsonb, $8::content_review_status)`,
    [
      id,
      skill.skillId,
      skill.areaId,
      opts.ageMin ?? 3,
      opts.ageMax ?? 7,
      opts.difficulty ?? 1,
      opts.prompt ?? "Pilih yang benar",
      opts.status ?? "PUBLISHED",
    ],
  );
  return id;
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `baseline${seq}@contoh.id`,
    displayName: `Baseline ${seq}`,
    password: "sand1-kuat-99",
  });
  assert.ok(reg.ok);
  if (!reg.ok) throw new Error("registrasi uji gagal");
  return reg.value.parentId;
}

async function makeChild(parentId: string, age: number): Promise<string> {
  const result = await profiles.createChildProfile(db, parentId, {
    nickname: `Anak ${randomUUID().slice(0, 6)}`,
    age,
  });
  assert.ok(result.ok);
  if (!result.ok) throw new Error("pembuatan profil anak gagal");
  return result.value.childId;
}

// ---------- endpoint harness ----------

class FakeCookies {
  private map = new Map<string, string>();
  get(name: string): { value: string } | undefined {
    const value = this.map.get(name);
    return value === undefined ? undefined : { value };
  }
  set(name: string, value: string, _opts: Record<string, unknown>): void {
    this.map.set(name, value);
  }
  delete(name: string, _opts?: Record<string, unknown>): void {
    this.map.delete(name);
  }
}

interface FakeContext {
  request: Request;
  url: URL;
  cookies: FakeCookies;
  locals: { parentSession?: { parentId: string; sessionId: string; expiresAt: Date } };
}

function makeContext(options: {
  parentId?: string;
  path?: string;
  method?: string;
  body?: unknown;
  origin?: string;
}): FakeContext {
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const path = options.path ?? "/api/assessment/baseline";
  const raw = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== undefined) headers.set("origin", options.origin);
  const request = new Request(`${ORIGIN}${path}`, { method, headers, body: raw });
  const locals: FakeContext["locals"] = {};
  if (options.parentId !== undefined) {
    locals.parentSession = {
      parentId: options.parentId,
      sessionId: "sesi-uji",
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  return { request, url: new URL(`${ORIGIN}${path}`), cookies: new FakeCookies(), locals };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: FakeContext): Promise<Response> {
  return handler(ctx);
}

// ---------- 8.1 usia menentukan kolam awal ----------

test("8.1 usia menentukan kolam awal: hanya PUBLISHED dan rentang usianya mencakup anak", async () => {
  const ageFit = await seedSkill("numbers");
  const ageTooOld = await seedSkill("numbers");
  const ageTooYoung = await seedSkill("numbers");

  const inPool = await seedActivity(ageFit, { ageMin: 3, ageMax: 7, prompt: "Cocok usia" });
  await seedActivity(ageTooOld, { ageMin: 6, ageMax: 7, prompt: "Untuk usia 6-7" });
  await seedActivity(ageTooYoung, { ageMin: 3, ageMax: 4, prompt: "Untuk usia 3-4" });
  const draft = await seedSkill("numbers");
  const draftId = await seedActivity(draft, { ageMin: 3, ageMax: 7, status: "DRAFT", prompt: "Belum direview" });

  const pool = await engine.selectBaselineActivities(db, 5, "seed-usia-5", 8);
  const ids = pool.map((a) => a.activityId);

  assert.ok(ids.includes(inPool), "aktivitas yang cocok usia harus masuk kolam");
  assert.ok(!ids.includes(draftId), "aktivitas DRAFT tidak boleh masuk asesmen (PRD §7)");
  for (const act of pool) {
    assert.ok(
      act.targetAgeMin <= 5 && act.targetAgeMax >= 5,
      `aktivitas ${act.activityId} di luar rentang usia anak`,
    );
  }
});

test("8.1 hasil seleksi selalu unik dan berupa subset aktivitas yang benar-benar ada", async () => {
  const pool = await engine.selectBaselineActivities(db, 3, "seed-usia-3", 8);
  const ids = pool.map((a) => a.activityId);
  assert.equal(new Set(ids).size, ids.length, "tidak boleh ada duplikat");
  for (const id of ids) {
    const row = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity WHERE id = $1::uuid AND review_status = 'PUBLISHED'`,
      [id],
    );
    assert.equal(Number(row.rows[0].count), 1, "hasil seleksi wajib menunjuk aktivitas PUBLISHED nyata");
  }
});

// ---------- 8.2 randomize within controlled difficulty ----------

test("8.2 pengacakan dalam band kesukaran terkendali: difficulty 1 dipakai dulu", async () => {
  // Kolam: 12 aktivitas difficulty 1 (2 per area, 6 area) + 12 difficulty 2.
  const areaCodes = ["numbers", "letters", "logic", "shapes", "world", "adab_islam"];
  const diff1: string[] = [];
  const diff2: string[] = [];
  for (const code of areaCodes) {
    for (let i = 0; i < 2; i++) {
      const s = await seedSkill(code, { difficulty: 1 });
      diff1.push(await seedActivity(s, { ageMin: 5, ageMax: 7, difficulty: 1 }));
    }
    const s2 = await seedSkill(code, { difficulty: 2 });
    diff2.push(await seedActivity(s2, { ageMin: 5, ageMax: 7, difficulty: 2 }));
  }

  const picked = await engine.selectBaselineActivities(db, 5, "seed-kendali-1", 8);
  const pickedIds = picked.map((a) => a.activityId);

  assert.equal(picked.length, 8, "default 8 aktivitas (VRD 8.8)");
  for (const act of picked) {
    assert.equal(act.difficulty, 1, "difficulty 2 tidak dipakai selama difficulty 1 mencukupi");
  }
  // Sebaran minimal satu per learning area sebelum mengulang.
  const areaCounts = new Map<string, number>();
  for (const act of picked) {
    areaCounts.set(act.learningAreaId, (areaCounts.get(act.learningAreaId) ?? 0) + 1);
  }
  assert.ok(
    [...areaCounts.values()].every((n) => n <= 3),
    "sebaran antar area tidak boleh timpang berlebihan",
  );
  assert.equal(new Set(pickedIds).size, pickedIds.length, "tidak ada aktivitas ganda");
});

test("8.2 seed deterministik: GET ulang mengembalikan kumpulan yang sama", async () => {
  const a = await engine.selectBaselineActivities(db, 5, "seed-anak-sama", 8);
  const b = await engine.selectBaselineActivities(db, 5, "seed-anak-sama", 8);
  assert.deepEqual(
    a.map((x) => x.activityId),
    b.map((x) => x.activityId),
    "seed sama → urutan sama",
  );

  const c = await engine.selectBaselineActivities(db, 5, "seed-anak-lain", 8);
  assert.notDeepEqual(
    a.map((x) => x.activityId),
    c.map((x) => x.activityId),
    "seed berbeda → kumpulan berbeda (pemilihan tidak selalu identik)",
  );
});

// ---------- 8.8 pendek ----------

test("8.8 asesmen pendek: dibatasi 5–10 aktivitas", async () => {
  const over = await engine.selectBaselineActivities(db, 5, "seed-banyak", 100);
  assert.ok(over.length <= 10, `meminta 100 → ${over.length} aktivitas (maks 10)`);

  const under = await engine.selectBaselineActivities(db, 5, "seed-sedikit", 1);
  assert.ok(under.length >= 5, `meminta 1 → ${under.length} aktivitas (min 5 bila kolam cukup)`);
});

// ---------- 8.4 estimasi kemampuan ----------

test("8.4 estimasi kemampuan per skill dari percobaan", () => {
  const skillA = randomUUID();
  const skillB = randomUUID();
  const skillC = randomUUID();

  const estimates = engine.calculateSkillEstimates([
    { activityId: randomUUID(), skillId: skillA, learningAreaId: randomUUID(), childAnswer: 1, isCorrect: true },
    { activityId: randomUUID(), skillId: skillA, learningAreaId: randomUUID(), childAnswer: 2, isCorrect: true },
    { activityId: randomUUID(), skillId: skillB, learningAreaId: randomUUID(), childAnswer: 1, isCorrect: true },
    { activityId: randomUUID(), skillId: skillB, learningAreaId: randomUUID(), childAnswer: 2, isCorrect: false },
    { activityId: randomUUID(), skillId: skillC, learningAreaId: randomUUID(), childAnswer: 1, isCorrect: false },
    { activityId: randomUUID(), skillId: skillC, learningAreaId: randomUUID(), childAnswer: 2, isCorrect: false },
  ]);

  assert.equal(estimates[skillA].correct, 2);
  assert.equal(estimates[skillA].total, 2);
  assert.equal(estimates[skillA].estimatedLevel, 3, "akurasi 100% → level 3");
  assert.equal(estimates[skillB].estimatedLevel, 2, "akurasi 50% → level 2");
  assert.equal(estimates[skillC].estimatedLevel, 1, "akurasi 0% → level 1");
  assert.equal(estimates[skillC].total, 2);
});

// ---------- 8.5 rekomendasi titik mulai ----------

test("8.5 rekomendasi titik mulai: skill yang belum dicoba lebih dulu, lalu level naik", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 5);

  const areaA = await seedSkill("numbers");
  const areaB = await seedSkill("letters");
  const untouched = await seedSkill("logic");
  await seedActivity(areaA, { ageMin: 3, ageMax: 7, difficulty: 1 });
  await seedActivity(areaB, { ageMin: 3, ageMax: 7, difficulty: 1 });
  await seedActivity(untouched, { ageMin: 3, ageMax: 7, difficulty: 1 });

  const estimates = engine.calculateSkillEstimates([
    { activityId: randomUUID(), skillId: areaA.skillId, learningAreaId: areaA.areaId, childAnswer: 1, isCorrect: true },
    { activityId: randomUUID(), skillId: areaA.skillId, learningAreaId: areaA.areaId, childAnswer: 1, isCorrect: true },
    { activityId: randomUUID(), skillId: areaB.skillId, learningAreaId: areaB.areaId, childAnswer: 1, isCorrect: false },
    { activityId: randomUUID(), skillId: areaB.skillId, learningAreaId: areaB.areaId, childAnswer: 1, isCorrect: false },
  ]);

  const recommended = await engine.getRecommendedStartingSkills(db, childId, 5, estimates);

  assert.ok(recommended.includes(areaA.skillId));
  assert.ok(recommended.includes(areaB.skillId));
  assert.ok(recommended.includes(untouched.skillId));
  assert.ok(
    recommended.indexOf(untouched.skillId) < recommended.indexOf(areaA.skillId),
    "skill yang belum dicoba direkomendasikan lebih dulu",
  );
  assert.ok(
    recommended.indexOf(areaB.skillId) < recommended.indexOf(areaA.skillId),
    "di antara skill yang sudah dicoba, level lebih rendah lebih dulu",
  );
});

// ---------- 8.3 penyimpanan percobaan ----------

test("8.3 hasil asesmen tersimpan: sesi baseline + percobaan + progres skill", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 5);

  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill, { ageMin: 3, ageMax: 7 });

  const attempts = [
    { activityId, skillId: skill.skillId, learningAreaId: skill.areaId, childAnswer: { id: "a" }, isCorrect: true, durationMs: 1200 },
    { activityId, skillId: skill.skillId, learningAreaId: skill.areaId, childAnswer: { id: "b" }, isCorrect: false },
  ];

  const estimates = engine.calculateSkillEstimates(attempts);
  const sessionId = await engine.storeBaselineResult(db, childId, {
    childId,
    attempts,
    skillEstimates: estimates,
    recommendedStartingSkills: [skill.skillId],
    completedAt: new Date(),
  });

  const sessions = await db.query<{ id: string }>(
    `SELECT id FROM learning_session WHERE id = $1::uuid AND started_at = ended_at`,
    [sessionId],
  );
  assert.equal(sessions.rows.length, 1, "sesi baseline tercatat (started_at = ended_at)");

  const stored = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_attempt WHERE child_id = $1::uuid AND session_id = $2::uuid`,
    [childId, sessionId],
  );
  assert.equal(Number(stored.rows[0].count), 2, "kedua percobaan tersimpan");

  const progress = await db.query<{ attempts_count: number; correct_count: number }>(
    `SELECT attempts_count, correct_count FROM learning_progress
      WHERE child_id = $1::uuid AND skill_id = $2::uuid`,
    [childId, skill.skillId],
  );
  assert.equal(progress.rows.length, 1, "progres skill dibuat");
  assert.equal(progress.rows[0].attempts_count, 2);
  assert.equal(progress.rows[0].correct_count, 1);

  assert.equal(await engine.hasCompletedBaseline(db, childId), true);
  assert.equal(await engine.hasCompletedBaseline(db, await makeChild(await makeParent(), 5)), false);
});

// ---------- 8.6 tanpa label lulus/gagal ----------

test("8.6 hasil tidak memuat label lulus/gagal (VRD 8.6 — tanpa mempermalukan)", () => {
  const skillId = randomUUID();
  const estimates = engine.calculateSkillEstimates([
    { activityId: randomUUID(), skillId, learningAreaId: randomUUID(), childAnswer: 1, isCorrect: false },
  ]);

  const forbidden = /lulus|gagal|pass|fail|stupid|bodoh|tertinggal|behind|rank|peringkat/i;
  const walk = (value: unknown, path: string): void => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      assert.ok(!forbidden.test(value), `label terlarang di ${path}: "${value}"`);
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assert.ok(!forbidden.test(k), `kunci terlarang di ${path}.${k}`);
      walk(v, `${path}.${k}`);
    }
  };

  walk(estimates, "skillEstimates");
  assert.deepEqual(Object.keys(estimates[skillId]).sort(), ["correct", "estimatedLevel", "total"]);
});

// ---------- endpoint: GET ----------

test("endpoint GET: tanpa sesi → 401, milik sendiri → 200, milik orang lain → 404 identik", async () => {
  const parentA = await makeParent();
  const parentB = await makeParent();
  const childA = await makeChild(parentA, 5);
  const childB = await makeChild(parentB, 5);

  const noSession = await call(api.GET, makeContext({ path: `/api/assessment/baseline?child=${childA}` }));
  assert.equal(noSession.status, 401);

  const own = await call(
    api.GET,
    makeContext({ parentId: parentA, path: `/api/assessment/baseline?child=${childA}` }),
  );
  assert.equal(own.status, 200);
  const ownBody = (await own.json()) as { activities: unknown[] };
  assert.ok(Array.isArray(ownBody.activities));
  assert.ok(ownBody.activities.length <= 10, "maksimal 10 aktivitas (VRD 8.8)");
  assert.equal(own.headers.get("cache-control"), "no-store");

  const other = await call(
    api.GET,
    makeContext({ parentId: parentB, path: `/api/assessment/baseline?child=${childA}` }),
  );
  const missing = await call(
    api.GET,
    makeContext({ parentId: parentB, path: `/api/assessment/baseline?child=${randomUUID()}` }),
  );
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json(), "balasan identik (anti-enumerasi)");
});

// ---------- endpoint: POST ----------

function validAttempts(activityId: string, skillId: string, areaId: string) {
  return Array.from({ length: 5 }, (_, i) => ({
    activityId,
    skillId,
    learningAreaId: areaId,
    childAnswer: { id: `opsi-${i}` },
    isCorrect: i < 3,
    durationMs: 900 + i,
  }));
}

test("endpoint POST: validasi 5–10 percobaan, lintas-asal, aktivitas tak terbit, lalu sukses", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 5);

  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill, { ageMin: 3, ageMax: 7 });
  const draftSkill = await seedSkill("letters");
  const draftId = await seedActivity(draftSkill, { status: "DRAFT" });

  const base = () =>
    makeContext({
      parentId,
      method: "POST",
      path: "/api/assessment/baseline",
      body: { childId, attempts: validAttempts(activityId, skill.skillId, skill.areaId) },
    });

  const crossOrigin = makeContext({
    parentId,
    method: "POST",
    origin: "https://contoh-licik.example",
    path: "/api/assessment/baseline",
    body: { childId, attempts: validAttempts(activityId, skill.skillId, skill.areaId) },
  });
  const cross = await call(api.POST, crossOrigin);
  assert.equal(cross.status, 403, "permintaan lintas-asal ditolak");

  const tooFew = makeContext({
    parentId,
    method: "POST",
    path: "/api/assessment/baseline",
    body: { childId, attempts: validAttempts(activityId, skill.skillId, skill.areaId).slice(0, 4) },
  });
  assert.equal((await call(api.POST, tooFew)).status, 400, "di bawah 5 percobaan ditolak");

  const tooMany = makeContext({
    parentId,
    method: "POST",
    path: "/api/assessment/baseline",
    body: {
      childId,
      attempts: Array.from({ length: 11 }, () => ({
        activityId,
        skillId: skill.skillId,
        learningAreaId: skill.areaId,
        childAnswer: { id: "x" },
        isCorrect: true,
      })),
    },
  });
  assert.equal((await call(api.POST, tooMany)).status, 400, "lebih dari 10 percobaan ditolak");

  const unpublished = makeContext({
    parentId,
    method: "POST",
    path: "/api/assessment/baseline",
    body: { childId, attempts: validAttempts(draftId, draftSkill.skillId, draftSkill.areaId) },
  });
  assert.equal((await call(api.POST, unpublished)).status, 400, "aktivitas DRAFT ditolak");

  const ok = await call(api.POST, base());
  assert.equal(ok.status, 201);
  const body = (await ok.json()) as {
    sessionId: string;
    skillEstimates: Record<string, unknown>;
    recommendedStartingSkills: string[];
  };
  assert.ok(body.sessionId);
  assert.ok(Object.keys(body.skillEstimates).length > 0);
  assert.ok(Array.isArray(body.recommendedStartingSkills));

  // Sekali selesai → GET dan POST berikutnya ditolak 409.
  const repeat = await call(api.POST, base());
  assert.equal(repeat.status, 409);
  const afterGet = await call(
    api.GET,
    makeContext({ parentId, path: `/api/assessment/baseline?child=${childId}` }),
  );
  assert.equal(afterGet.status, 409);
});

// ---------- 8.7 memulai ulang ----------

test("8.7 orang tua bisa memulai ulang asesmen; riwayat jawaban tetap tersimpan", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 5);

  const skill = await seedSkill("logic");
  const activityId = await seedActivity(skill, { ageMin: 3, ageMax: 7 });

  const post = await call(
    api.POST,
    makeContext({
      parentId,
      method: "POST",
      path: "/api/assessment/baseline",
      body: { childId, attempts: validAttempts(activityId, skill.skillId, skill.areaId) },
    }),
  );
  assert.equal(post.status, 201);

  const attemptsBefore = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );

  const crossOrigin = makeContext({
    parentId,
    method: "DELETE",
    origin: "https://contoh-licik.example",
    path: `/api/assessment/baseline?child=${childId}`,
  });
  assert.equal((await call(api.DELETE, crossOrigin)).status, 403, "lintas-asal ditolak");

  const del = await call(
    api.DELETE,
    makeContext({ parentId, method: "DELETE", path: `/api/assessment/baseline?child=${childId}` }),
  );
  assert.equal(del.status, 200);
  assert.deepEqual(await del.json(), { reset: true });

  const getAgain = await call(
    api.GET,
    makeContext({ parentId, path: `/api/assessment/baseline?child=${childId}` }),
  );
  assert.equal(getAgain.status, 200, "asesmen bisa diulang setelah reset");

  const attemptsAfter = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );
  assert.equal(
    attemptsAfter.rows[0].count,
    attemptsBefore.rows[0].count,
    "riwayat jawaban tidak ikut terhapus (VRD 8.7: reset ≠ hapus jejak)",
  );
});
