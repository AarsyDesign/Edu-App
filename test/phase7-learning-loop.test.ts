/**
 * Learning loop (VRD 7.5–7.7) — halaman area, layar aktivitas, penyimpanan
 * percobaan, dan penutupan sesi.
 *
 * Menguji: tautan area tidak lagi 404 (7.5), kepemilikan dikunci di server,
 * payload dirakit ulang & gagal aman (6.14), penilaian ada di server (6.9),
 * percobaan + progres tersimpan (PRD §10), sesi bisa ditutup idempoten (7.7),
 * serta layar baru memakai token desain tanpa nilai visual hardcoded.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

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
const content = await import("../src/lib/activity/content.ts");
const attemptApi = await import("../src/pages/api/activity/attempt.ts");
const sessionApi = await import("../src/pages/api/session/complete.ts");
const sessions = await import("../src/lib/progress/sessions.ts");
const renderer = await import("../src/lib/activity/renderer.ts");
const { activityTestFixtures } = await import("../src/lib/activity/domain.ts");

after(async () => {
  await closeDb();
});

const root = new URL("../", import.meta.url).pathname;
const read = (p: string) => readFileSync(root + p, "utf8");
const ORIGIN = "http://localhost:4321";

const FORBIDDEN_LABELS = /lulus|gagal|\bpass\b|\bfail\b|stupid|bodoh|tertinggal|behind|rank|peringkat/i;

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

async function seedActivity(
  skill: { skillId: string; areaId: string },
  opts: { status?: string; interactionType?: string } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type, correct_answer, review_status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Manakah yang benar?', $4, '{}'::jsonb, $5::content_review_status)`,
    [id, skill.skillId, skill.areaId, opts.interactionType ?? "TAP_ANSWER", opts.status ?? "PUBLISHED"],
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
  const rows = await db.query<{ id: string; is_correct: boolean }>(
    `SELECT id, is_correct FROM activity_option WHERE activity_id = $1::uuid ORDER BY position`,
    [activityId],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows[0].is_correct, true);
  return { rightId: rows.rows[0].id, wrongId: rows.rows[1].id };
}

let seq = 0;
async function makeParent(): Promise<string> {
  seq += 1;
  const reg = await registerParent(db, {
    email: `loop${seq}@contoh.id`,
    displayName: `Loop ${seq}`,
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

function makeContext(options: {
  parentId?: string;
  path?: string;
  method?: string;
  body?: unknown;
  origin?: string;
}): FakeContext {
  const method = options.method ?? "POST";
  const path = options.path ?? "/api/activity/attempt";
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

// ---------- 7.5 halaman detail area ----------

test("7.5 halaman detail area ada dan mengunci kepemilikan sebelum merender", () => {
  const page = read("src/pages/learn/area/[code].astro");
  assert.ok(existsSync(root + "src/pages/learn/area/[code].astro"));
  assert.ok(page.includes("parentIdOf"), "wajib cek sesi orang tua");
  assert.ok(page.includes('Astro.redirect("/login")'), "tanpa sesi harus ke /login");
  assert.ok(page.includes('Astro.redirect("/parent")'), "id anak asing harus ke /parent");
  assert.ok(page.includes("getChildForParent"), "kepemilikan dicek di server (VRD 3.7)");
  assert.ok(page.includes("listPublishedActivitiesForAreaAndAge"), "daftar aktivitas per area + usia");
  assert.ok(page.includes("getLearningAreaByCode"));
  // Area tak dikenal dialihkan seperti area non-aktif (anti-enumerasi)
  assert.ok(page.includes(`/learn?child=`), "area tak dikenal harus kembali ke /learn");
});

test("7.5 tautan area di child home kini menunjuk halaman yang benar-benar ada", () => {
  const home = read("src/pages/learn.astro");
  assert.ok(home.includes("/learn/area/"), "child home menautkan halaman area");
  assert.ok(existsSync(root + "src/pages/learn/area/[code].astro"));
  // Tombol Mulai di child home tidak lagi mem-post form ke endpoint JSON (400).
  assert.ok(!home.includes('action="/api/session/start"'), "form JSON rusak harus diganti tautan halaman");
  assert.ok(home.includes("/learn/aktivitas/"));
  assert.ok(existsSync(root + "src/pages/learn/aktivitas/[id].astro"));
});

// ---------- pemetaan payload → ActivityData (6.13/6.14) ----------

function optionRow(id: string, position: number, payload: Record<string, unknown>, isCorrect = false) {
  return { id, position, payload, isCorrect };
}

test("6.13 payload dirakit dari activity_option untuk tipe berbasis pilihan", () => {
  const tap = content.buildActivityData({
    type: "TAP_ANSWER",
    prompt: "Pilih bintang",
    correctAnswer: null,
    options: [
      optionRow("o1", 0, { label: "Bintang" }, true),
      optionRow("o2", 1, { label: "Bulan" }),
    ],
  });
  assert.ok(tap && tap.type === "tap_answer");
  assert.equal((tap as { items: unknown[] }).items.length, 2);
  assert.equal((tap as { items: Array<{ isCorrect: boolean }> }).items[0].isCorrect, true);

  const mc = content.buildActivityData({
    type: "MULTIPLE_CHOICE",
    prompt: "Buah apa yang kuning?",
    correctAnswer: null,
    options: [
      optionRow("m1", 0, { label: "Pisang" }, true),
      optionRow("m2", 1, { label: "Apel" }),
    ],
  });
  assert.ok(mc && mc.type === "multiple_choice");
  assert.equal((mc as { question: string }).question, "Buah apa yang kuning?");

  const seq = content.buildActivityData({
    type: "SEQUENCE",
    prompt: "Urutkan",
    correctAnswer: null,
    options: [
      optionRow("s1", 0, { label: "1" }),
      optionRow("s2", 1, { label: "2" }),
      optionRow("s3", 2, { label: "3" }),
    ],
  });
  assert.ok(seq && seq.type === "sequence");
  assert.deepEqual(
    (seq as { items: Array<{ correctPosition: number }> }).items.map((i) => i.correctPosition),
    [0, 1, 2],
  );
});

test("6.13 jawaban non-pilihan diambil dari correct_answer", () => {
  const count = content.buildActivityData({
    type: "COUNT_OBJECTS",
    prompt: "Hitung bintang",
    correctAnswer: 5,
    options: [optionRow("c1", 0, { visualKey: "star", count: 5 })],
  });
  assert.ok(count && count.type === "count_objects");
  assert.equal((count as { correctAnswer: number }).correctAnswer, 5);

  const tf = content.buildActivityData({
    type: "TRUE_FALSE",
    prompt: "Hari memiliki 24 jam",
    correctAnswer: true,
    options: [],
  });
  assert.ok(tf && tf.type === "true_false");
  assert.equal((tf as { statement: string }).statement, "Hari memiliki 24 jam");
  assert.equal((tf as { correctAnswer: boolean }).correctAnswer, true);
});

test("6.14 payload rusak / belum didukung gagal aman (null, bukan crash)", () => {
  // Tanpa pilihan sama sekali
  assert.equal(
    content.buildActivityData({ type: "TAP_ANSWER", prompt: "x", correctAnswer: null, options: [] }),
    null,
  );
  // Tepat dua pilihan wajib benar — dua benar → invalid
  assert.equal(
    content.buildActivityData({
      type: "TAP_ANSWER",
      prompt: "x",
      correctAnswer: null,
      options: [optionRow("a", 0, { label: "A" }, true), optionRow("b", 1, { label: "B" }, true)],
    }),
    null,
  );
  // Label hilang → validator menolak
  assert.equal(
    content.buildActivityData({
      type: "TAP_ANSWER",
      prompt: "x",
      correctAnswer: null,
      options: [optionRow("a", 0, {}, true), optionRow("b", 1, { label: "B" })],
    }),
    null,
  );
  // correct_answer bukan angka untuk COUNT_OBJECTS
  assert.equal(
    content.buildActivityData({
      type: "COUNT_OBJECTS",
      prompt: "x",
      correctAnswer: "banyak",
      options: [optionRow("c1", 0, { visualKey: "star", count: 3 })],
    }),
    null,
  );
  // MATCH: pemetaan sisi tidak terbaca dari skema → sengaja gagal aman
  assert.equal(
    content.buildActivityData({
      type: "MATCH",
      prompt: "x",
      correctAnswer: null,
      options: [optionRow("l1", 0, { label: "1" }), optionRow("r1", 1, { label: "1" })],
    }),
    null,
  );
});

test("6.13 bila correct_answer memuat objek ActivityData utuh, objek itu dipakai (dan divalidasi)", () => {
  const whole = {
    type: "true_false",
    statement: "Air mendidih pada suhu 100 derajat",
    correctAnswer: true,
  };
  const built = content.buildActivityData({ type: "TRUE_FALSE", prompt: "x", correctAnswer: whole, options: [] });
  assert.ok(built && built.type === "true_false");
  assert.equal((built as { statement: string }).statement, "Air mendidih pada suhu 100 derajat");

  const broken = { type: "tap_answer", items: [{ id: "a", label: "A" }] };
  const builtBroken = content.buildActivityData({
    type: "TAP_ANSWER",
    prompt: "x",
    correctAnswer: broken,
    options: [],
  });
  assert.equal(builtBroken, null, "objek utuh yang tidak valid tidak boleh dipakai");
});

// ---------- endpoint percobaan ----------

test("endpoint attempt: tanpa sesi 401, lintas-asal 403, kepemilikan 404 identik", async () => {
  const parentA = await makeParent();
  const parentB = await makeParent();
  const childA = await makeChild(parentA);
  const childB = await makeChild(parentB);

  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill);
  const { rightId } = await seedTapOptions(activityId);
  const sessionA = await makeOpenSession(childA);

  const body = { childId: childA, activityId, sessionId: sessionA, answer: rightId };

  const noSession = await call(attemptApi.POST, makeContext({ body }));
  assert.equal(noSession.status, 401);

  const cross = await call(
    attemptApi.POST,
    makeContext({ parentId: parentA, body, origin: "https://contoh-licik.example" }),
  );
  assert.equal(cross.status, 403);

  const other = await call(attemptApi.POST, makeContext({ parentId: parentB, body }));
  const missing = await call(
    attemptApi.POST,
    makeContext({ parentId: parentB, body: { ...body, childId: randomUUID() } }),
  );
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json(), "balasan identik (anti-enumerasi)");
});

test("endpoint attempt: penilaian di server — jawaban salah tidak bisa diklaim benar", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const skill = await seedSkill("numbers");
  const activityId = await seedActivity(skill);
  const { rightId, wrongId } = await seedTapOptions(activityId);
  const sessionId = await makeOpenSession(childId);

  const base = () => ({ childId, activityId, sessionId });

  // Klien mengirim klaim `isCorrect: true` dengan jawaban salah → tetap salah.
  const cheat = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), answer: wrongId, isCorrect: true } }),
  );
  assert.equal(cheat.status, 201);
  const cheatBody = (await cheat.json()) as { correct: boolean; explanation: string };
  assert.equal(cheatBody.correct, false, "kebenaran ditentukan server (VRD 6.9)");
  assert.ok(cheatBody.explanation.length > 0);
  assert.ok(!FORBIDDEN_LABELS.test(cheatBody.explanation), "tanpa label lulus/gagal");

  const right = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), answer: rightId, durationMs: 1500 } }),
  );
  const rightBody = (await right.json()) as { correct: boolean; attemptNo: number };
  assert.equal(rightBody.correct, true);
  assert.equal(rightBody.attemptNo, 2, "attempt_no bertambah untuk percobaan berikutnya");

  const attempts = await db.query<{ attempt_no: number; is_correct: boolean; session_id: string }>(
    `SELECT attempt_no, is_correct, session_id FROM activity_attempt
      WHERE child_id = $1::uuid AND activity_id = $2::uuid ORDER BY attempt_no`,
    [childId, activityId],
  );
  assert.equal(attempts.rows.length, 2, "percobaan tersimpan (PRD §10)");
  assert.equal(attempts.rows[0].is_correct, false);
  assert.equal(attempts.rows[1].is_correct, true);
  assert.ok(attempts.rows.every((r) => r.session_id === sessionId), "percobaan menempel pada sesi");

  const progress = await db.query<{ attempts_count: number; correct_count: number }>(
    `SELECT attempts_count, correct_count FROM learning_progress
      WHERE child_id = $1::uuid AND skill_id = $2::uuid`,
    [childId, skill.skillId],
  );
  assert.equal(progress.rows.length, 1, "progres skill diperbarui");
  assert.equal(progress.rows[0].attempts_count, 2);
  assert.equal(progress.rows[0].correct_count, 1);
});

test("endpoint attempt: sesi basa/asing/tidak valid ditolak & aktivitas belum siap aman", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const otherChild = await makeChild(parentId);
  const skill = await seedSkill("letters");
  const activityId = await seedActivity(skill);
  const { rightId } = await seedTapOptions(activityId);
  const sessionId = await makeOpenSession(childId);

  const base = () => ({ childId, activityId, sessionId, answer: rightId });

  // Sesi milik anak lain → ditolak
  const stolenSession = await makeOpenSession(otherChild);
  const stolen = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), sessionId: stolenSession } }),
  );
  assert.equal(stolen.status, 400);

  // Sesi tidak ada → ditolak
  const ghost = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), sessionId: randomUUID() } }),
  );
  assert.equal(ghost.status, 400);

  // Aktivitas tanpa pilihan → ACTIVITY_NOT_READY (gagal aman, tidak dinilai)
  const emptySkill = await seedSkill("letters");
  const emptyActivity = await seedActivity(emptySkill);
  const notReady = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), activityId: emptyActivity } }),
  );
  assert.equal(notReady.status, 400);
  assert.equal(((await notReady.json()) as { error: string }).error, "ACTIVITY_NOT_READY");

  // Aktivitas belum dipublikasikan → 404
  const draftSkill = await seedSkill("letters");
  const draftActivity = await seedActivity(draftSkill, { status: "DRAFT" });
  const draft = await call(
    attemptApi.POST,
    makeContext({ parentId, body: { ...base(), activityId: draftActivity } }),
  );
  assert.equal(draft.status, 404);

  const stored = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_attempt WHERE child_id = $1::uuid`,
    [childId],
  );
  assert.equal(Number(stored.rows[0].count), 0, "tidak ada percobaan tersimpan dari permintaan yang ditolak");
});

// ---------- 7.6/7.7 sesi ----------

test("7.7 endpoint sesi selesai: kepemilikan, idempoten, dan tidak menyentuh sesi baseline", async () => {
  const parentId = await makeParent();
  const childId = await makeChild(parentId);
  const otherChild = await makeChild(parentId);
  const sessionId = await makeOpenSession(childId);

  const noSession = await call(sessionApi.POST, makeContext({ body: { sessionId, childId } }));
  assert.equal(noSession.status, 401);

  const cross = await call(
    sessionApi.POST,
    makeContext({
      parentId,
      body: { sessionId, childId },
      origin: "https://contoh-licik.example",
    }),
  );
  assert.equal(cross.status, 403);

  const stolen = await call(
    sessionApi.POST,
    makeContext({ parentId, body: { sessionId: await makeOpenSession(otherChild), childId } }),
  );
  assert.equal(stolen.status, 400);

  const done = await call(sessionApi.POST, makeContext({ parentId, body: { sessionId, childId } }));
  assert.equal(done.status, 200);
  const body = (await done.json()) as { sessionId: string; endedAt: string };
  assert.equal(body.sessionId, sessionId);
  assert.ok(body.endedAt);

  const again = await call(sessionApi.POST, makeContext({ parentId, body: { sessionId, childId } }));
  assert.equal(again.status, 200, "menutup sesi yang sudah tertutup idempoten");
  assert.deepEqual(await again.json(), body, "balasan tidak berubah");

  // Sesi baseline (started_at = ended_at) tidak bisa ditutup lewat endpoint ini.
  const baseline = await db.query<{ id: string }>(
    `INSERT INTO learning_session (child_id, started_at, ended_at)
     VALUES ($1::uuid, now(), now()) RETURNING id`,
    [childId],
  );
  const baselineId = baseline.rows[0].id;
  const viaBaseline = await call(
    sessionApi.POST,
    makeContext({ parentId, body: { sessionId: baselineId, childId } }),
  );
  assert.equal(viaBaseline.status, 400, "jalur sesi baseline terpisah (Phase 8)");
});

// ---------- layar baru: anti-slop ----------

test("layar area & aktivitas: token desain, status bukan warna saja, tanpa nilai hardcoded", () => {
  const areaPage = read("src/pages/learn/area/[code].astro");
  const playPage = read("src/pages/learn/aktivitas/[id].astro");
  const activityCss = read("src/styles/activity.css");

  for (const [name, source] of [
    ["area", areaPage],
    ["aktivitas", playPage],
    ["activity.css", activityCss],
  ] as const) {
    // Selain hex ikon SVG, nilai visual harus lewat token.
    const hexes = [...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
    const allowed = new Set(["#174a3a"]); // warna garis ikon, sama dengan palet DESIGN.md
    const stray = hexes.filter((h) => !allowed.has(h));
    assert.deepEqual(stray, [], `${name}: nilai warna hardcoded di luar token: ${stray.join(", ")}`);
    assert.ok(!/gradient\(/.test(source), `${name}: tanpa gradien dekoratif`);
  }

  // Touch target & status bukan warna saja
  assert.ok(activityCss.includes("--touch-min"), "target sentuh memakai token");
  assert.ok(activityCss.includes("✓ dipilih"), "status terpilih juga disampaikan lewat teks");
  assert.ok(playPage.includes('role="alert"'), "keadaan gagal aman punya penanda status");
  assert.ok(read("public/activity/runtime.js").includes("aria-valuenow"), "kemajuan diumumkan ke pembaca layar");

  // Gerbang keyboard: seluruh kontrol interaksi berupa elemen yang bisa fokus
  const runtime = read("public/activity/runtime.js");
  assert.ok(runtime.includes("feedback"), "umpan balik langsung wajib ada (PRD §10)");
  // Status yang dilihat anak: netral, tanpa peringkat/gelar kelulusan.
  assert.ok(runtime.includes("Benar!") && runtime.includes("Belum tepat."));
  assert.ok(!/peringkat|leaderboard|\brank/i.test(runtime), "tanpa peringkat di klien");
});

test("berkas klien tiap tipe aktivitas ada dan memakai endpoint yang benar", () => {
  const files = [
    "tap-answer",
    "count-objects",
    "match",
    "sequence",
    "identify-color",
    "identify-shape",
    "multiple-choice",
    "true-false",
  ];
  for (const name of files) {
    const path = `public/activity/${name}.js`;
    assert.ok(existsSync(root + path), `${path} belum ada (renderer mengimpornya)`);
    const source = read(path);
    assert.ok(source.includes("runtime.js"), `${path} harus memakai runtime bersama`);
    assert.ok(!/fetch\(/.test(source), `${path} tidak boleh menilai/mengirim sendiri di luar runtime`);
  }
  const runtime = read("public/activity/runtime.js");
  assert.ok(runtime.includes("/api/activity/attempt"), "jawaban dikirim ke penilaian server");
  assert.ok(runtime.includes("/api/session/complete"), "sesi ditutup saat anak pindah");
});

test("renderer: swatch warna tidak lolos sebagai teks ter-escape & CSS konten dibatasi heksa", () => {
  const html = renderer.renderActivity({
    activityId: "act-1",
    type: "IDENTIFY_COLOR",
    prompt: "Cari warna merah",
    data: activityTestFixtures.IDENTIFY_COLOR,
    childAge: 5,
    audioEnabled: false,
    reducedMotion: false,
  });
  assert.ok(html.includes('<span class="color-swatch"'), "swatch dirender sebagai elemen");
  assert.ok(!html.includes("&lt;span"), "markup tidak boleh tampil sebagai teks");

  const injected = renderer.renderActivity({
    activityId: "act-2",
    type: "IDENTIFY_COLOR",
    prompt: "Cari warna merah",
    data: {
      type: "identify_color",
      targetColorName: "merah",
      options: [
        { id: "c1", colorValue: "red;background:url(javascript:x)", colorName: "merah", isCorrect: true },
        { id: "c2", colorValue: "#0000FF", colorName: "biru", isCorrect: false },
      ],
    },
    childAge: 5,
    audioEnabled: false,
    reducedMotion: false,
  });
  assert.ok(!injected.includes("background:url"), "nilai warna non-heksa tidak boleh masuk gaya");
  assert.ok(injected.includes("background:#0000FF"), "heksa valid tetap dipakai");
});
