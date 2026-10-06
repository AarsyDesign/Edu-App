/**
 * Phase 9 — mesin progress (VRD 9.1–9.5).
 *
 * Menguji: 9.1 percobaan tersimpan dan bertahan lintas sesi, 9.2 ringkasan
 * penyelesaian area konsisten dengan riwayat (tanpa korupsi saat diulang),
 * 9.3 akurasi per skill sebagai angka fakta, 9.4 performa terkini berjendela,
 * 9.5 rekomendasi deterministik + terisolasi antar anak, 9.6 tidak ada ambang
 * mastery diam-diam, dan 9.7 keluaran tanpa label lulus/gagal/peringkat.
 *
 * Tanpa UI di run ini → checklist layar dilewati (tanpa layar baru).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Harus disetel SEBELUM modul db diimpor.
process.env.PGLITE_MODE = "memory";

const db = await (async () => {
  const mod = await import("../src/lib/db/index.ts");
  return mod.getDb();
})();
const { closeDb } = await import("../src/lib/db/index.ts");
const { registerParent } = await import("../src/lib/auth/accounts.ts");
const profiles = await import("../src/lib/children/profiles.ts");
const areas = await import("../src/lib/learning/areas-skills.ts");
const sessions = await import("../src/lib/progress/sessions.ts");
const engine = await import("../src/lib/progress/engine.ts");
const recommendation = await import("../src/lib/progress/recommendation.ts");
const attemptApi = await import("../src/pages/api/activity/attempt.ts");
const { listPublishedActivitiesForAge } = await import("../src/lib/activity/api.ts");

after(async () => {
  await closeDb();
});

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");
const ORIGIN = "http://localhost:4321";

const FORBIDDEN_LABELS =
  /lulus|gagal|\bpass\b|\bfail\b|stupid|bodoh|tertinggal|behind|rank|peringkat|leaderboard/i;

// ---------- helper seed ----------

async function seedSkill(areaCode: string): Promise<{ skillId: string; areaId: string }> {
  const area = await areas.getLearningAreaByCode(db, areaCode);
  assert.ok(area, `area ${areaCode} harus ada dari migrasi 0003`);
  const skillId = randomUUID();
  await db.query(
    `INSERT INTO skill (id, learning_area_id, code, title, age_min, age_max, difficulty)
     VALUES ($1::uuid, $2::uuid, $3, $4, 3, 7, 1)`,
    [skillId, area.areaId, `sk_${skillId.slice(0, 8)}`, `Skill ${skillId.slice(0, 4)}`],
  );
  return { skillId, areaId: area.areaId };
}

async function seedActivity(skill: { skillId: string; areaId: string }): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type, correct_answer, review_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Manakah yang benar?', 'TAP_ANSWER', '{}'::jsonb, 'PUBLISHED')`,
    [id, skill.skillId, skill.areaId],
  );
  return id;
}

async function seedTapOptions(activityId: string): Promise<{ rightId: string; wrongId: string }> {
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
    `SELECT id FROM activity_option WHERE activity_id = $1::uuid ORDER BY position`,
    [activityId],
  );
  assert.equal(rows.rows.length, 2);
  return { rightId: rows.rows[0].id, wrongId: rows.rows[1].id };
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `prog${seq}@contoh.id`,
    displayName: `Prog ${seq}`,
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

async function makeOpenSession(childId: string): Promise<string> {
  const row = await sessions.startActivitySession(db, childId);
  return row.sessionId;
}

// ---------- endpoint harness ----------

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

interface FakeContext {
  request: Request;
  url: URL;
  cookies: FakeCookies;
  locals: { parentSession?: { parentId: string; sessionId: string; expiresAt: Date } };
}

function makeContext(options: { parentId?: string; body?: unknown; origin?: string }): FakeContext {
  const path = "/api/activity/attempt";
  const raw = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== undefined) headers.set("origin", options.origin);
  const request = new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: raw });
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

/** Kirim satu jawaban lewat endpoint penilaian server; kembalikan id percobaan. */
async function submit(options: {
  parentId: string;
  childId: string;
  activityId: string;
  sessionId: string;
  answer: string;
}): Promise<{ attemptId: string; correct: boolean }> {
  const res = await call(attemptApi.POST, makeContext({ parentId: options.parentId, body: options }));
  assert.equal(res.status, 201, "jawaban sah harus diterima");
  const body = (await res.json()) as { attemptId: string; correct: boolean };
  return body;
}

// ---------- 9.1 / 9.2 ----------

test("9.1/9.2 percobaan tersimpan, riwayat tidak korup saat diulang, ringkasan area konsisten", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill);
  const { rightId, wrongId } = await seedTapOptions(activityId);
  const sessionId = await makeOpenSession(childId);

  // 6 percobaan bergantian salah/benar → 3 benar.
  for (let i = 0; i < 6; i += 1) {
    const answer = i % 2 === 0 ? wrongId : rightId;
    const res = await submit({ parentId, childId, activityId, sessionId, answer });
    assert.equal(res.correct, i % 2 === 1);
  }

  // Riwayat menumpuk (append-only), tidak tertimpa.
  const history = await db.query<{ attempt_no: number; is_correct: boolean }>(
    `SELECT attempt_no, is_correct FROM activity_attempt
      WHERE child_id = $1::uuid AND activity_id = $2::uuid
      ORDER BY attempt_no`,
    [childId, activityId],
  );
  assert.equal(history.rows.length, 6, "riwayat percobaan utuh (VRD 9.1)");
  assert.deepEqual(
    history.rows.map((r) => r.attempt_no),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(history.rows.filter((r) => r.is_correct).length, 3);

  // Progres skill = fakta yang sama, dihitung ulang dari riwayat.
  const accuracy = await engine.getSkillAccuracy(db, childId, [skill.skillId]);
  assert.equal(accuracy.length, 1);
  assert.equal(accuracy[0].attempts, 6);
  assert.equal(accuracy[0].correct, 3);
  assert.ok(accuracy[0].accuracy !== null && Math.abs(accuracy[0].accuracy - 0.5) < 1e-9);
  assert.ok(accuracy[0].lastPracticedAt, "waktu praktik terakhir tercatat");

  const stored = await db.query<{ attempts_count: number; correct_count: number }>(
    `SELECT attempts_count, correct_count FROM learning_progress
      WHERE child_id = $1::uuid AND skill_id = $2::uuid`,
    [childId, skill.skillId],
  );
  assert.equal(stored.rows[0].attempts_count, 6);
  assert.equal(stored.rows[0].correct_count, 3);

  // 9.2 penyelesaian per area: satu skill disentuh, belum ada yang dikuasai.
  const area = await recommendation.getAreaProgress(db, childId, [skill.areaId]);
  assert.deepEqual(area[skill.areaId], { attempted: 1, completed: 0, total: 1 });

  // Percobaan di sesi berikutnya menambah riwayat, bukan menimpanya.
  const sessionId2 = await makeOpenSession(childId);
  await submit({ parentId, childId, activityId, sessionId: sessionId2, answer: rightId });
  const afterMore = await engine.getSkillAccuracy(db, childId, [skill.skillId]);
  assert.equal(afterMore[0].attempts, 7);
  assert.equal(afterMore[0].correct, 4);
  const history2 = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );
  assert.equal(Number(history2.rows[0].count), 7, "percobaan lintas sesi tidak menghilang");
});

// ---------- 9.3 ----------

test("9.3 akurasi per skill: angka fakta, null tanpa data, urut deterministik", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const s1 = await seedSkill("letters");
  const s2 = await seedSkill("logic");

  // Tanpa data: bukan 0%, bukan 100% — null (VRD 9.7).
  const kosong = await engine.getSkillAccuracy(db, childId);
  assert.deepEqual(kosong, [], "tanpa baris progres = daftar kosong, bukan angka karangan");

  // Skill yang diminta ikut muncul dengan angka 0 dan accuracy null.
  const diminta = await engine.getSkillAccuracy(db, childId, [s2.skillId, s1.skillId]);
  assert.equal(diminta.length, 2);
  assert.deepEqual(
    diminta.map((r) => [r.skillId, r.attempts, r.correct, r.accuracy]),
    [
      [s1.skillId, 0, 0, null],
      [s2.skillId, 0, 0, null],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "en")),
    "urut skillId ASC dan tetap null bila belum dipraktikkan",
  );
  assert.deepEqual(await engine.getSkillAccuracy(db, childId, [s2.skillId, s1.skillId]), diminta);

  // Satu jawaban benar → akurasi 1 untuk skill itu, skill lain tetap null.
  const activityId = await seedActivity(s1);
  const { rightId } = await seedTapOptions(activityId);
  const sessionId = await makeOpenSession(childId);
  await submit({ parentId, childId, activityId, sessionId, answer: rightId });

  const setelah = await engine.getSkillAccuracy(db, childId, [s1.skillId, s2.skillId]);
  const row1 = setelah.find((r) => r.skillId === s1.skillId);
  const row2 = setelah.find((r) => r.skillId === s2.skillId);
  assert.ok(row1 && row2);
  assert.equal(row1.attempts, 1);
  assert.equal(row1.correct, 1);
  assert.equal(row1.accuracy, 1);
  assert.equal(row2.accuracy, null, "skill yang belum disentuh tidak ikut terangka");
});

// ---------- 9.4 ----------

test("9.4 performa terkini: jendela dibatasi, terbaru dulu, sebaran jawaban salah", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const skillA = await seedSkill("numbers");
  const skillB = await seedSkill("shapes");
  const activityA = await seedActivity(skillA);
  const activityB = await seedActivity(skillB);
  const optA = await seedTapOptions(activityA);
  const optB = await seedTapOptions(activityB);
  const sessionId = await makeOpenSession(childId);

  const submitted: string[] = [];
  // 12 percobaan bergantian dua skill: 6 salah + 6 benar.
  for (let i = 0; i < 3; i += 1) {
    for (const [activity, opt] of [
      [activityA, optA],
      [activityB, optB],
    ] as const) {
      const wrong = await submit({
        parentId,
        childId,
        activityId: activity,
        sessionId,
        answer: opt.wrongId,
      });
      submitted.push(wrong.attemptId);
      const right = await submit({
        parentId,
        childId,
        activityId: activity,
        sessionId,
        answer: opt.rightId,
      });
      submitted.push(right.attemptId);
    }
  }
  assert.equal(submitted.length, 12);

  const recent = await engine.getRecentPerformance(db, childId);
  assert.equal(recent.window, engine.RECENT_WINDOW_DEFAULT);
  assert.equal(recent.total, 10, "jendela bawaan memotong ke 10 percobaan terakhir");
  assert.equal(recent.attempts.length, 10);
  assert.equal(recent.attempts[0].attemptId, submitted[11], "yang terbaru tampil lebih dulu");
  assert.deepEqual(
    new Set(recent.attempts.map((a) => a.attemptId)),
    new Set(submitted.slice(-10)),
    "isi jendela = 10 percobaan terakhir (tanpa duplikat, tanpa yang lama)",
  );
  // Waktu tidak pernah naik dari baris pertama ke terakhir.
  for (let i = 1; i < recent.attempts.length; i += 1) {
    assert.ok(recent.attempts[i].createdAt <= recent.attempts[i - 1].createdAt);
  }

  const benar = recent.attempts.filter((a) => a.isCorrect).length;
  assert.ok(recent.accuracy !== null && Math.abs(recent.accuracy - benar / 10) < 1e-9);
  const salah = recent.attempts.filter((a) => !a.isCorrect);
  assert.equal(
    Object.values(recent.errorsBySkill).reduce((a, b) => a + b, 0),
    salah.length,
    "sebaran salah = jumlah jawaban salah di dalam jendela",
  );
  assert.ok(Object.keys(recent.errorsBySkill).every((id) => id === skillA.skillId || id === skillB.skillId));

  // Jendela eksplisit dan batas rentang.
  const tiga = await engine.getRecentPerformance(db, childId, { window: 3 });
  assert.equal(tiga.total, 3);
  assert.deepEqual(
    new Set(tiga.attempts.map((a) => a.attemptId)),
    new Set(submitted.slice(-3)),
  );
  const nol = await engine.getRecentPerformance(db, childId, { window: 0 });
  assert.equal(nol.window, engine.RECENT_WINDOW_DEFAULT, "0 di luar rentang → jendela bawaan, bukan 'tanpa data'");
  const raksasa = await engine.getRecentPerformance(db, childId, { window: 9999 });
  assert.equal(raksasa.window, engine.RECENT_WINDOW_DEFAULT);

  // Anak tanpa percobaan: daftar kosong + accuracy null (bukan 0%).
  const anakKosong = await makeChild(parentId);
  const kosong = await engine.getRecentPerformance(db, anakKosong);
  assert.equal(kosong.total, 0);
  assert.deepEqual(kosong.attempts, []);
  assert.equal(kosong.accuracy, null);
  assert.deepEqual(kosong.errorsBySkill, {});

  // Kepulauan: anak lain tidak melihat percobaan anak ini.
  const anakLain = await makeChild(await makeParent());
  const punyaOrangLain = await engine.getRecentPerformance(db, anakLain);
  assert.equal(punyaOrangLain.total, 0, "data anak terisolasi per child_id");
});

// ---------- 9.5 ----------

test("9.5 rekomendasi deterministik, terisolasi antar anak, null saat semua skill dikuasai", async () => {
  const parentA = await makeParent();
  const parentB = await makeParent();
  const childA = await makeChild(parentA);
  const childB = await makeChild(parentB);

  const skill = await seedSkill("world");
  const activityId = await seedActivity(skill);
  const { wrongId } = await seedTapOptions(activityId);

  // Keadaan sama → keluaran sama, dipanggil berapa kali pun.
  const rec1 = await recommendation.getNextRecommendation(db, childA, 5);
  const rec2 = await recommendation.getNextRecommendation(db, childA, 5);
  assert.ok(rec1);
  assert.deepEqual(rec1, rec2, "rekomendasi deterministik (VRD 9.5)");
  assert.deepEqual(await recommendation.getNextRecommendation(db, childB, 5), rec1);

  // Percobaan anak A tidak bocor ke anak B.
  const sessionId = await makeOpenSession(childA);
  await submit({ parentId: parentA, childId: childA, activityId, sessionId, answer: wrongId });
  const progresA = await engine.getSkillAccuracy(db, childA, [skill.skillId]);
  const progresB = await engine.getSkillAccuracy(db, childB, [skill.skillId]);
  assert.equal(progresA[0].attempts, 1);
  assert.equal(progresB[0].attempts, 0, "progress anak tidak bocor antar akun");
  assert.equal(progresB[0].accuracy, null);

  // Bila semua skill sudah dikuasai → null (cabang yang belum pernah tercapai).
  const published = await listPublishedActivitiesForAge(db, 5);
  assert.ok(published.length > 0);
  for (const skillId of new Set(published.map((a) => a.skillId))) {
    await db.query(
      `INSERT INTO learning_progress (child_id, skill_id, attempts_count, correct_count, mastered_at)
       VALUES ($1::uuid, $2::uuid, 1, 1, now())
       ON CONFLICT (child_id, skill_id) DO UPDATE SET mastered_at = now()`,
      [childB, skillId],
    );
  }
  assert.equal(await recommendation.getNextRecommendation(db, childB, 5), null);
  assert.ok(
    await recommendation.getNextRecommendation(db, childA, 5),
    "anak yang belum menguasai apa pun tetap mendapat rekomendasi",
  );
});

// ---------- 9.6 ----------

test("9.6 tanpa ambang mastery diam-diam: mastered_at tetap null, modul mesin hanya membaca", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const skill = await seedSkill("adab_islam");
  const activityId = await seedActivity(skill);
  const { rightId } = await seedTapOptions(activityId);
  const sessionId = await makeOpenSession(childId);

  for (let i = 0; i < 5; i += 1) {
    await submit({ parentId, childId, activityId, sessionId, answer: rightId });
  }

  const row = await db.query<{ mastered_at: Date | null; attempts_count: number }>(
    `SELECT mastered_at, attempts_count FROM learning_progress
      WHERE child_id = $1::uuid AND skill_id = $2::uuid`,
    [childId, skill.skillId],
  );
  assert.equal(row.rows[0].attempts_count, 5);
  assert.equal(
    row.rows[0].mastered_at,
    null,
    "VRD 9.6: ambang mastery hanya bila ada bukti — bukti belum ada, jadi tidak ditulis diam-diam",
  );

  // Mesin progress bersifat baca murni: tidak ada pernyataan tulis.
  const source = read("src/lib/progress/engine.ts");
  assert.ok(!/\bINSERT\s+INTO\b/i.test(source), "engine.ts tidak menulis data");
  assert.ok(!/\bUPDATE\s+/i.test(source), "engine.ts tidak mengubah data");
  assert.ok(!/\bDELETE\s+/i.test(source), "engine.ts tidak menghapus data");

  // Rekomendasi tetap ada (loop tidak buntu) selama belum ada yang dikuasai.
  const rec = await recommendation.getNextRecommendation(db, childId, 5);
  assert.ok(rec, "rekomendasi masih diberikan tanpa ambang mastery");
});

// ---------- 9.7 ----------

test("9.7 keluaran mesin tanpa label lulus/gagal/peringkat dan tanpa angka dari data kosong", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const skill = await seedSkill("letters");
  const activityId = await seedActivity(skill);
  const { rightId, wrongId } = await seedTapOptions(activityId);

  // Data kosong → accuracy null, bukan persentase karangan.
  const kosongAccuracy = await engine.getSkillAccuracy(db, childId, [skill.skillId]);
  assert.equal(kosongAccuracy[0].accuracy, null);
  const kosongRecent = await engine.getRecentPerformance(db, childId);
  assert.equal(kosongRecent.accuracy, null);

  // Setelah ada data, akurasi tetap angka murni.
  const sessionId = await makeOpenSession(childId);
  await submit({ parentId, childId, activityId, sessionId, answer: wrongId });
  await submit({ parentId, childId, activityId, sessionId, answer: rightId });
  const ada = await engine.getSkillAccuracy(db, childId, [skill.skillId]);
  assert.equal(typeof ada[0].accuracy, "number");

  // Tidak ada label lulus/gagal/peringkat di seluruh keluaran mesin.
  const payload = JSON.stringify({
    accuracy: ada,
    recent: await engine.getRecentPerformance(db, childId),
    kosong: kosongRecent,
  });
  assert.ok(!FORBIDDEN_LABELS.test(payload), `keluaran mesin memuat label terlarang: ${payload}`);
});
