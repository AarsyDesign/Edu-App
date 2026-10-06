/**
 * Phase 9.8 — ringkasan progres siap-baca orang tua (VRD 9.8).
 *
 * Menguji: endpoint `GET /api/parent/progress` menjaga sesi + kepemilikan
 * (VRD 3.5/3.7/3.8), angka kosong tampil jujur (`accuracy: null`, bukan 0/100),
 * fakta sesi/area/skill dirangkum tanpa label lulus-gagal (VRD 9.6/9.7),
 * jendela performa terkini mengikuti aturan engine, dan badan respons tidak
 * membocorkan `parentAccountId` atau data milik orang tua lain.
 *
 * Tanpa UI di run ini → checklist layar dilewati (tanpa layar baru).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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
const summary = await import("../src/lib/progress/summary.ts");
const attemptApi = await import("../src/pages/api/activity/attempt.ts");
const progressApi = await import("../src/pages/api/parent/progress.ts");

after(async () => {
  await closeDb();
});

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
  await db.query(
    `INSERT INTO activity_option (activity_id, position, payload, is_correct)
     VALUES ($1::uuid, 0, $2, true), ($1::uuid, 1, $3, false)`,
    [
      id,
      JSON.stringify({ label: "Bintang" }),
      JSON.stringify({ label: "Bulan" }),
    ],
  );
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM activity_option WHERE activity_id = $1::uuid ORDER BY position`,
    [id],
  );
  assert.equal(rows.rows.length, 2);
  return id;
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `sum${seq}@contoh.id`,
    displayName: `Sum ${seq}`,
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

function makeContext(options: {
  parentId?: string;
  path?: string;
  query?: Record<string, string>;
}): FakeContext {
  const path = options.path ?? "/api/parent/progress";
  const url = new URL(`${ORIGIN}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);
  const request = new Request(url, { method: "GET", headers: new Headers() });
  const locals: FakeContext["locals"] = {};
  if (options.parentId !== undefined) {
    locals.parentSession = {
      parentId: options.parentId,
      sessionId: "sesi-uji",
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
  return { request, url, cookies: new FakeCookies(), locals };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: FakeContext): Promise<Response> {
  return handler(ctx);
}

async function getSummary(
  parentId: string | undefined,
  query: Record<string, string>,
): Promise<Response> {
  return call(progressApi.GET, makeContext({ parentId, query }));
}

async function bodyOf(res: Response): Promise<Record<string, any>> {
  return (await res.json()) as Record<string, any>;
}

// ---------- 9.8 gerbang ----------

test("9.8 tanpa sesi → 401; tanpa parameter child → 400", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);

  const anon = await getSummary(undefined, { child: childId });
  assert.equal(anon.status, 401);
  assert.equal(((await anon.json()) as any).error, "UNAUTHENTICATED");

  const noChild = await getSummary(parentId, {});
  assert.equal(noChild.status, 400);
  assert.equal(((await noChild.json()) as any).error, "BAD_REQUEST");
});

test("9.8 kepemilikan: id milik orang lain / id rusak / id tak ada → 404 identik", async () => {
  const owner = await makeParent();
  const other = await makeParent();
  const childId = await makeChild(owner);

  const foreign = await getSummary(other, { child: childId });
  const missing = await getSummary(other, { child: randomUUID() });
  const malformed = await getSummary(other, { child: "bukan-uuid" });
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(malformed.status, 404);
  const [a, b, c] = [await foreign.json(), await missing.json(), await malformed.json()];
  assert.deepEqual(a, b, "id asing dan id tak ada harus tampak sama (anti-enumerasi)");
  assert.deepEqual(b, c, "id rusak tidak boleh berbeda dari id tak ada");

  // Pemilik sendiri tetap boleh membaca.
  const own = await getSummary(owner, { child: childId });
  assert.equal(own.status, 200);
});

// ---------- 9.8 data kosong (dijalankan sebelum ada data belajar) ----------

test("9.8 anak tanpa riwayat → angka kosong jujur, tanpa label, tanpa kebocoran", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 4);

  const res = await getSummary(parentId, { child: childId });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await bodyOf(res);

  assert.equal(body.child.childId, childId);
  assert.equal(body.child.age, 4);
  assert.equal(body.child.parentAccountId, undefined, "parentAccountId tidak boleh keluar");

  const p = body.progress;
  assert.equal(p.childId, childId);
  assert.equal(p.totals.attempts, 0);
  assert.equal(p.totals.correct, 0);
  assert.equal(p.totals.accuracy, null, "akurasi tidak dipaksa keluar dari data kosong");
  assert.equal(p.totals.skillsPracticed, 0);
  assert.equal(p.recent.window, 10, "jendela bawaan (VRD 9.4)");
  assert.equal(p.recent.total, 0);
  assert.equal(p.recent.accuracy, null);
  assert.deepEqual(p.recent.errorsBySkill, {});
  assert.equal(p.sessions.total, 0);
  assert.equal(p.sessions.completed, 0);
  assert.equal(p.sessions.baseline, 0);
  assert.equal(p.sessions.totalDurationMs, null, "durasi null, bukan 0 menit palsu");
  assert.equal(p.sessions.lastEndedAt, null);
  assert.equal(p.lastPracticedAt, null);
  assert.equal(p.nextRecommendation, null, "belum ada aktivitas published");

  assert.equal(p.areas.length, 6, "enam learning area MVP (PRD §4)");
  for (const area of p.areas) {
    assert.equal(area.attempted, 0);
    assert.equal(area.completed, 0);
    assert.ok(typeof area.totalSkills === "number");
    assert.ok(area.code && area.title, "area membawa judul dari database, bukan hardcoded");
  }
  assert.deepEqual(p.skills, [], "tanpa baris progres → tanpa skill yang dikarang");

  const raw = JSON.stringify(body);
  assert.ok(!FORBIDDEN_LABELS.test(raw), "ringkasan tidak boleh memuat label lulus/gagal/peringkat");
  assert.ok(!raw.includes("parentAccountId"));
});

// ---------- 9.8 merangkum data belajar ----------

test("9.8 merangkum percobaan, sesi, area, dan saran latihan setelah belajar", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId, 5);
  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill);

  const optRows = await db.query<{ id: string; is_correct: boolean }>(
    `SELECT id, is_correct FROM activity_option WHERE activity_id = $1::uuid ORDER BY position`,
    [activityId],
  );
  const rightId = optRows.rows[0].id;
  const wrongId = optRows.rows[1].id;

  // Sesi belajar: 6 jawaban bergantian → 3 benar, lalu ditutup.
  const open = await sessions.startActivitySession(db, childId);
  const submitRes = await fetchLike(parentId, {
    childId,
    activityId,
    sessionId: open.sessionId,
    answers: [wrongId, rightId, wrongId, rightId, wrongId, rightId],
  });
  assert.equal(submitRes, 6, "enam jawaban tersimpan");
  await sessions.completeLearningSession(db, open.sessionId);

  // Sesi asesmen dasar (penanda started_at = ended_at) dihitung terpisah.
  await db.query(
    `INSERT INTO learning_session (child_id, started_at, ended_at)
     VALUES ($1::uuid, now(), now())`,
    [childId],
  );

  const res = await getSummary(parentId, { child: childId });
  assert.equal(res.status, 200);
  const p = (await bodyOf(res)).progress;

  assert.equal(p.totals.attempts, 6);
  assert.equal(p.totals.correct, 3);
  assert.ok(Math.abs(p.totals.accuracy - 0.5) < 1e-9);
  assert.equal(p.totals.skillsPracticed, 1);
  assert.ok(p.lastPracticedAt, "waktu praktik terakhir ikut terbawa");

  const area = p.areas.find((a: { areaId: string }) => a.areaId === skill.areaId);
  assert.ok(area, "area tempat berlatih ada dalam ringkasan");
  assert.equal(area.attempted, 1);
  assert.equal(area.completed, 0, "belum ada mastery — VRD 9.6 menunggu bukti");

  assert.equal(p.skills.length, 1);
  assert.equal(p.skills[0].skillId, skill.skillId);
  assert.equal(p.skills[0].attempts, 6);
  assert.equal(p.skills[0].correct, 3);

  assert.equal(p.recent.total, 6, "jendela bawaan 10 muat seluruh percobaan");
  assert.ok(Math.abs(p.recent.accuracy - 0.5) < 1e-9);
  assert.equal(p.recent.errorsBySkill[skill.skillId], 3, "sebaran jawaban salah (PRD §21)");

  assert.equal(p.sessions.completed, 1);
  assert.equal(p.sessions.baseline, 1, "sesi asesmen dihitung terpisah");
  assert.equal(p.sessions.open, 0);
  assert.equal(p.sessions.total, 2);
  assert.ok(typeof p.sessions.totalDurationMs === "number" && p.sessions.totalDurationMs >= 0);
  assert.ok(p.sessions.lastEndedAt);

  assert.ok(p.nextRecommendation, "saran latihan berikutnya tersedia (PRD §12)");
  assert.equal(p.nextRecommendation.skillId, skill.skillId);

  const raw = JSON.stringify(p);
  assert.ok(!FORBIDDEN_LABELS.test(raw), "tanpa label lulus/gagal/peringkat di ringkasan");
});

test("9.8 jendela performa terkini: permintaan sah dipakai, nilai buruk jatuh ke bawaan", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);

  const small = await bodyOf(await getSummary(parentId, { child: childId, window: "3" }));
  assert.equal(small.progress.recent.window, 3, "window sah diterima");

  const zero = await bodyOf(await getSummary(parentId, { child: childId, window: "0" }));
  assert.equal(zero.progress.recent.window, 10, "window 0 → bawaan, bukan 'tanpa data'");

  const junk = await bodyOf(await getSummary(parentId, { child: childId, window: "abc" }));
  assert.equal(junk.progress.recent.window, 10);
});

test("9.8 fungsi ringkasan hanya membaca (tanpa tulis di modul)", async () => {
  const source = (await import("node:fs")).readFileSync(
    new URL("../src/lib/progress/summary.ts", import.meta.url).pathname,
    "utf8",
  );
  assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/i.test(source), "modul ringkasan bersifat baca murni");
});

// ---------- pengirim jawaban berurutan (harness kecil) ----------

async function fetchLike(
  parentId: string,
  options: {
    childId: string;
    activityId: string;
    sessionId: string;
    answers: string[];
  },
): Promise<number> {
  let stored = 0;
  for (const answer of options.answers) {
    const body = {
      childId: options.childId,
      activityId: options.activityId,
      sessionId: options.sessionId,
      answer,
    };
    const headers = new Headers({ "content-type": "application/json" });
    const request = new Request(`${ORIGIN}/api/activity/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const ctx = {
      request,
      url: new URL(`${ORIGIN}/api/activity/attempt`),
      cookies: new FakeCookies(),
      locals: {
        parentSession: {
          parentId,
          sessionId: "sesi-uji",
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (attemptApi.POST as any)(ctx);
    assert.equal(res.status, 201, `jawaban ${answer} harus diterima`);
    stored += 1;
  }
  return stored;
}
