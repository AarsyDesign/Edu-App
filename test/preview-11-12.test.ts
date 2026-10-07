/**
 * Test Phase 11.12 — pratinjau aktivitas sebagai anak.
 *
 * Menguji: endpoint `/api/reviewer/aktivitas/:id/preview` (gerbang sesi,
 * lintas asal, rate limit, penilaian benar/salah, TANPA tulis ke tabel anak),
 * preview aktivitas berstatus DRAFT sementara feed anak tetap tertutup,
 * kegagalan aman payload tak bisa dirakit, kesetaraan markup dengan perender
 * produksi, dan berkas UI halaman pratinjau + tautan di layar detail.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const db = await getDb();
const { listLearningAreas, listAllSkillsWithArea } = await import(
  "../src/lib/learning/areas-skills.ts"
);
const { resetRateLimits } = await import("../src/lib/auth/rate-limit.ts");
const { getReviewerActivityDetail } = await import(
  "../src/lib/activity/reviewer.ts"
);
const { getPublishedActivityById } = await import("../src/lib/activity/api.ts");
const { buildActivityData, loadActivityOptions } = await import(
  "../src/lib/activity/content.ts"
);
const { renderActivity } = await import("../src/lib/activity/renderer.ts");
import type { ActivityType } from "../src/lib/activity/domain.ts";
const guard = await import("../src/lib/auth/reviewer-guard.ts");
const createRoute = await import("../src/pages/api/reviewer/aktivitas/index.ts");
const previewRoute = await import(
  "../src/pages/api/reviewer/aktivitas/[id]/preview.ts"
);

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";
const areas = await listLearningAreas(db);
const skills = await listAllSkillsWithArea(db);
const area = areas[0];
const skill = skills.find((s) => s.learningAreaId === area.areaId)!;

// Akun reviewer untuk kolom sesi (`locals.reviewerSession`, VRD 11.1).
const reviewerId = randomUUID();
await db.query(
  `INSERT INTO reviewer_account (id, email, display_name)
   VALUES ($1::uuid, 'peninjau@contoh.test', 'Peninjau Uji')`,
  [reviewerId],
);
const reviewerLocals = {
  locals: { reviewerSession: { reviewerId, expiresAt: new Date() } },
};

function makeRequest(
  path: string,
  init: { method?: string; body?: unknown; origin?: string } = {},
): Request {
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", init.origin ?? ORIGIN);
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, ctx: Record<string, unknown>): Promise<Response> {
  return handler(ctx);
}

function tapPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    prompt: "Mana yang berwarna merah?",
    interaction_type: "TAP_ANSWER",
    learning_area_id: area.areaId,
    skill_id: skill.skillId,
    target_age_min: 3,
    target_age_max: 5,
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
    ...overrides,
  };
}

async function createDraft(overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await call(createRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload(overrides) }),
    ...reviewerLocals,
  });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  return body.activityId as string;
}

function postPreview(
  activityId: string,
  body: unknown,
  extra: { origin?: string; locals?: unknown } = {},
): Promise<Response> {
  return call(previewRoute.POST, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}/preview`, {
      method: "POST",
      body,
      origin: extra.origin,
    }),
    params: { id: activityId },
    locals: extra.locals !== undefined ? extra.locals : reviewerLocals.locals,
  });
}

async function childRowCounts(): Promise<Record<string, number>> {
  const result = await db.query<{ name: string; count: string }>(`
    SELECT 'learning_session' AS name, count(*)::text AS count FROM learning_session
    UNION ALL
    SELECT 'activity_attempt', count(*)::text FROM activity_attempt
    UNION ALL
    SELECT 'learning_progress', count(*)::text FROM learning_progress
  `);
  return Object.fromEntries(
    result.rows.map((r) => [r.name, Number(r.count)]),
  );
}

// ---------- gerbang keamanan ----------

test("11.12 endpoint: tanpa sesi → 401, lintas asal → 403", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const noSession = await postPreview(activityId, { answer: { id: "opt-1" } }, {
    locals: { reviewerSession: undefined },
  });
  assert.equal(noSession.status, 401);
  assert.equal((await noSession.json()).error, "UNAUTHENTICATED");

  const crossOrigin = await postPreview(activityId, { answer: { id: "opt-1" } }, {
    origin: "https://contoh-jahat.test",
  });
  assert.equal(crossOrigin.status, 403);
});

test("11.12 gerbang rute: halaman pratinjau ikut terlindungi guard reviewer", () => {
  assert.equal(
    guard.isReviewerProtectedPath("/reviewer/aktivitas/abc/pratinjau"),
    true,
  );
  assert.equal(
    guard.isReviewerProtectedPath("/api/reviewer/aktivitas/abc/preview"),
    true,
  );
});

// ---------- penilaian tanpa tulis data ----------

test("11.12 endpoint: benar & salah dinilai server, nol baris anak ditulis", async () => {
  resetRateLimits();
  const activityId = await createDraft();
  const before = await childRowCounts();

  const benar = await postPreview(activityId, { answer: { id: "opt-1" } });
  assert.equal(benar.status, 200, await benar.clone().text());
  const benarBody = await benar.json();
  assert.equal(benarBody.preview, true);
  assert.equal(benarBody.correct, true);
  assert.ok(typeof benarBody.explanation === "string" && benarBody.explanation.length > 0);

  const salah = await postPreview(activityId, { answer: { id: "opt-2" } });
  assert.equal(salah.status, 200, await salah.clone().text());
  const salahBody = await salah.json();
  assert.equal(salahBody.correct, false);
  assert.ok(typeof salahBody.explanation === "string" && salahBody.explanation.length > 0);

  const after_ = await childRowCounts();
  assert.deepEqual(after_, before, "pratinjau tidak boleh menulis tabel anak");
});

test("11.12 endpoint: jawaban kosong → 400, id tak dikenal → 404", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const noAnswer = await postPreview(activityId, { durationMs: 100 });
  assert.equal(noAnswer.status, 400);
  assert.equal((await noAnswer.json()).error, "BAD_REQUEST");

  const missing = await postPreview(
    "00000000-0000-4000-8000-000000000000",
    { answer: { id: "opt-1" } },
  );
  assert.equal(missing.status, 404);
});

test("11.12 payload tak bisa dirakit → 400 ACTIVITY_NOT_READY (gagal aman)", async () => {
  resetRateLimits();
  const activityId = await createDraft();
  // Rusakkan isi persis seperti payload korup: tanpa objek ActivityData utuh
  // dan tanpa baris opsi yang cukup untuk dirakit ulang.
  await db.query(`UPDATE activity SET correct_answer = '{}'::jsonb WHERE id = $1::uuid`, [
    activityId,
  ]);
  await db.query(`DELETE FROM activity_option WHERE activity_id = $1::uuid`, [activityId]);

  const res = await postPreview(activityId, { answer: { id: "opt-1" } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "ACTIVITY_NOT_READY");
});

// ---------- DRAFT bisa dipreview, feed anak tetap tertutup ----------

test("11.12 DRAFT bisa dipreview; feed anak tetap hanya PUBLISHED", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const detail = await getReviewerActivityDetail(db, activityId);
  assert.equal(detail!.activity.reviewStatus, "DRAFT");

  const res = await postPreview(activityId, { answer: { id: "opt-1" } });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await res.json()).correct, true);

  assert.equal(
    await getPublishedActivityById(db, activityId),
    null,
    "aktivitas DRAFT tidak boleh terbaca layar anak",
  );
});

// ---------- kesetaraan markup dengan produksi ----------

test("11.12 pratinjau menghasilkan markup identik dengan layar anak", async () => {
  resetRateLimits();
  const activityId = await createDraft();
  await db.query(`UPDATE activity SET review_status = 'PUBLISHED' WHERE id = $1::uuid`, [
    activityId,
  ]);
  const childAge = 4;

  // Jalur produksi: hanya PUBLISHED + opsi dari tabel.
  const published = await getPublishedActivityById(db, activityId);
  assert.ok(published, "aktivitas harus terbaca layar anak setelah terbit");
  const productionData = buildActivityData({
    type: published!.interactionType as ActivityType,
    prompt: published!.prompt,
    correctAnswer: published!.correctAnswer,
    options: await loadActivityOptions(db, activityId),
  });
  assert.ok(productionData);
  const productionHtml = renderActivity({
    activityId,
    type: published!.interactionType as ActivityType,
    prompt: published!.prompt,
    data: productionData!,
    explanation: published!.explanation,
    childAge,
    audioEnabled: false,
    reducedMotion: false,
  });

  // Jalur pratinjau: detail reviewer (status apa pun) + opsi dari tabel yang sama.
  const detail = await getReviewerActivityDetail(db, activityId);
  const previewData = buildActivityData({
    type: detail!.activity.interactionType as ActivityType,
    prompt: detail!.activity.prompt,
    correctAnswer: detail!.activity.correctAnswer,
    options: detail!.options,
  });
  assert.ok(previewData);
  const previewHtml = renderActivity({
    activityId,
    type: detail!.activity.interactionType as ActivityType,
    prompt: detail!.activity.prompt,
    data: previewData!,
    explanation: detail!.activity.explanation,
    childAge,
    audioEnabled: false,
    reducedMotion: false,
  });

  assert.equal(previewHtml, productionHtml, "markup pratinjau harus identik produksi");
  assert.ok(productionHtml.includes('data-child-age="4"'));
});

// ---------- berkas UI ----------

/**
 * Kunci properti objek input `renderActivity(...)` — mendukung shorthand
 * (`data,`) maupun pasangan biasa (`prompt: ...`) supaya kedua halaman bisa
 * dibandingkan ekuivalennya.
 */
function renderActivityKeys(source: string): string[] {
  const start = source.indexOf("renderActivity({");
  assert.ok(start >= 0, "panggilan renderActivity tidak ditemukan");
  const slice = source.slice(start);
  const end = slice.indexOf("})");
  assert.ok(end >= 0, "blok renderActivity tidak tertutup");
  return slice
    .slice(0, end)
    .split("\n")
    .map((line) => line.match(/^\s*(\w+)\s*[:,]/)?.[1])
    .filter((key): key is string => Boolean(key))
    .sort();
}

test("11.12 UI: kedua layar memanggil renderActivity dengan input yang sama", async () => {
  const childPage = await readFile(
    new URL("../src/pages/learn/aktivitas/[id].astro", import.meta.url),
    "utf8",
  );
  const previewPage = await readFile(
    new URL("../src/pages/reviewer/aktivitas/[id]/pratinjau.astro", import.meta.url),
    "utf8",
  );
  assert.deepEqual(
    renderActivityKeys(previewPage),
    renderActivityKeys(childPage),
    "input perender pratinjau harus sama dengan produksi",
  );
  for (const literal of ["audioEnabled: false", "reducedMotion: false"]) {
    assert.ok(childPage.includes(literal), `layar anak: ${literal}`);
    assert.ok(previewPage.includes(literal), `pratinjau: ${literal}`);
  }
});

test("11.12 UI: halaman pratinjau punya penanda mode, pilih usia, dan tanpa nilai hardcoded", async () => {
  const page = await readFile(
    new URL("../src/pages/reviewer/aktivitas/[id]/pratinjau.astro", import.meta.url),
    "utf8",
  );
  // Penanda mode pratinjau + endpoint penilaian sendiri (tanpa data anak).
  assert.ok(page.includes("preview: true"));
  assert.ok(page.includes("/preview"));
  assert.ok(page.includes("activity.css"), "markup aktivitas harus pakai gaya produksi");
  assert.ok(page.includes("initActivityChrome"));
  // Keadaan:404, payload gagal dirakit, dan catatan "tidak disimpan".
  assert.ok(page.includes('role="alert"'));
  assert.ok(page.includes("Isi belum bisa dirakit"));
  assert.ok(page.includes("tidak disimpan"));
  // Pilih usia dalam rentang target; status usia lewat teks/aria, bukan warna saja.
  assert.ok(page.includes("age-switch"));
  assert.ok(page.includes('aria-current'));
  assert.ok(page.includes("Status:"));
  // Nilai visual hanya token.
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(page), "warna hardcoded di halaman pratinjau");
  assert.ok(!/\d+ms\b/.test(page), "durasi ms hardcoded di halaman pratinjau");

  const detail = await readFile(
    new URL("../src/pages/reviewer/aktivitas/[id].astro", import.meta.url),
    "utf8",
  );
  assert.ok(detail.includes("/pratinjau"), "layar detail harus menautkan pratinjau");
});

test("11.12 UI: runtime menilai lewat endpoint pratinjau & tanpa sesi anak", async () => {
  const runtime = await readFile(
    new URL("../public/activity/runtime.js", import.meta.url),
    "utf8",
  );
  assert.ok(runtime.includes("cfg.preview === true"));
  assert.ok(runtime.includes("cfg.previewAnswerUrl"));
  // Pratinjau tidak mengirim childId/sessionId…
  assert.ok(
    runtime.includes("? { activityId, answer, durationMs: Date.now() - startedAt }"),
    "body pratinjau tidak membawa childId/sessionId",
  );
  assert.ok(
    runtime.includes("childId: cfg.childId"),
    "jalur produksi tetap mengirim childId/sessionId",
  );
  // …dan tidak menutup sesi anak.
  assert.ok(runtime.includes("if (cfg.preview === true)"));
  assert.ok(runtime.includes("cfg.homeUrl ??"));
});
