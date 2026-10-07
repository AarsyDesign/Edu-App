/**
 * Test Phase 11.11 — transisi status review + jejak provenance.
 *
 * Menguji: matriks transisi sesuai PRD §7, penersaan matriks di database
 * (migrasi 0005), endpoint `POST /api/reviewer/aktivitas/:id/status`
 * (gerbang sesi/origin/rate limit, penolakan transisi di luar alur, catatan,
 * jejak `content_review` + sinkronisasi `activity.review_status`), riwayat
 * yang dibaca layar, dan berkas UI panel alur review.
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
const {
  REVIEW_TRANSITIONS,
  canTransition,
  allowedTransitions,
  isReviewStatus,
  parseReviewNotes,
  listReviewHistory,
} = await import("../src/lib/activity/review-flow.ts");
const { listLearningAreas, listAllSkillsWithArea } = await import(
  "../src/lib/learning/areas-skills.ts"
);
const { getReviewerActivityDetail, getReviewStatusLabel } = await import(
  "../src/lib/activity/reviewer.ts"
);
const { resetRateLimits } = await import("../src/lib/auth/rate-limit.ts");
const createRoute = await import("../src/pages/api/reviewer/aktivitas/index.ts");
const itemRoute = await import("../src/pages/api/reviewer/aktivitas/[id].ts");
const statusRoute = await import(
  "../src/pages/api/reviewer/aktivitas/[id]/status.ts"
);

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";
const areas = await listLearningAreas(db);
const skills = await listAllSkillsWithArea(db);
const area = areas[0];
const skill = skills.find((s) => s.learningAreaId === area.areaId)!;

// Akun reviewer untuk kolom `content_review.reviewer` (FK migrasi 0004).
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

function tapPayload(): Record<string, unknown> {
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
  };
}

async function createDraft(): Promise<string> {
  const res = await call(createRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload() }),
    ...reviewerLocals,
  });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  return body.activityId as string;
}

function postStatus(
  activityId: string,
  toStatus: string,
  extra: { notes?: unknown; origin?: string; locals?: unknown } = {},
): Promise<Response> {
  return call(statusRoute.POST, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}/status`, {
      method: "POST",
      body: { to_status: toStatus, ...(extra.notes !== undefined ? { notes: extra.notes } : {}) },
      origin: extra.origin,
    }),
    params: { id: activityId },
    locals: extra.locals !== undefined ? extra.locals : reviewerLocals.locals,
  });
}

async function currentStatus(activityId: string): Promise<string> {
  const detail = await getReviewerActivityDetail(db, activityId);
  return detail?.activity.reviewStatus ?? "";
}

// ---------- matriks transisi (PRD §7) ----------

test("11.11 matriks transisi persis mengikuti PRD §7", () => {
  const matrix = Object.fromEntries(
    Object.entries(REVIEW_TRANSITIONS).map(([from, list]) => [
      from,
      list.map((t) => t.to),
    ]),
  );
  assert.deepEqual(matrix, {
    DRAFT: ["HUMAN_REVIEW"],
    HUMAN_REVIEW: ["QA_APPROVED", "DRAFT"],
    QA_APPROVED: ["PUBLISHED"],
    PUBLISHED: ["FLAGGED", "UNPUBLISHED"],
    FLAGGED: ["HUMAN_REVIEW", "UNPUBLISHED"],
    UNPUBLISHED: ["HUMAN_REVIEW"],
  });
});

test("11.11/11.13 penerbitan hanya dari QA_APPROVED; tidak ada lompatan langsung", () => {
  assert.equal(canTransition("QA_APPROVED", "PUBLISHED"), true);
  assert.equal(canTransition("DRAFT", "PUBLISHED"), false);
  assert.equal(canTransition("HUMAN_REVIEW", "PUBLISHED"), false);
  assert.equal(canTransition("PUBLISHED", "HUMAN_REVIEW"), false);
  assert.equal(canTransition("FLAGGED", "PUBLISHED"), false);
  // status yang sama tidak pernah jadi transisi (CHECK from <> to)
  assert.equal(canTransition("DRAFT", "DRAFT"), false);
  // status tak dikenal aman ditolak, bukan melempar
  assert.equal(canTransition("LIVE_NOW", "PUBLISHED"), false);
  assert.equal(isReviewStatus("LIVE_NOW"), false);
  assert.deepEqual(allowedTransitions("DRAFT").map((t) => t.kind), ["primary"]);
});

test("11.11 parseReviewNotes: opsional, di-trim, dibatasi 2000 karakter", () => {
  assert.deepEqual(parseReviewNotes(undefined), { ok: true, notes: null });
  assert.deepEqual(parseReviewNotes("   "), { ok: true, notes: null });
  assert.deepEqual(parseReviewNotes("  jawaban sudah diperiksa  "), {
    ok: true,
    notes: "jawaban sudah diperiksa",
  });
  assert.equal(parseReviewNotes("x".repeat(2001)).ok, false);
  assert.equal(parseReviewNotes(42).ok, false);
});

// ---------- penersaan di database (migrasi 0005) ----------

test("11.13 trigger DB menolak transisi di luar alur PRD §7", async () => {
  const activityId = await createDraft();

  await assert.rejects(
    db.query(
      `INSERT INTO content_review (activity_id, from_status, to_status)
       VALUES ($1::uuid, 'DRAFT', 'PUBLISHED')`,
      [activityId],
    ),
    /violates/i,
  );

  // Dari status yang salah juga ditolak (from_status ≠ review_status)
  await assert.rejects(
    db.query(
      `INSERT INTO content_review (activity_id, from_status, to_status)
       VALUES ($1::uuid, 'PUBLISHED', 'UNPUBLISHED')`,
      [activityId],
    ),
    /violates/i,
  );

  assert.equal(await currentStatus(activityId), "DRAFT");
  const rows = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM content_review WHERE activity_id = $1::uuid`,
    [activityId],
  );
  assert.equal(Number(rows.rows[0].count), 0);
});

test("11.11 transisi sah tercatat di content_review dan menyinkronkan status", async () => {
  const activityId = await createDraft();
  await db.query(
    `INSERT INTO content_review (activity_id, from_status, to_status, reviewer)
     VALUES ($1::uuid, 'DRAFT', 'HUMAN_REVIEW', $2::uuid)`,
    [activityId, reviewerId],
  );

  const detail = await getReviewerActivityDetail(db, activityId);
  assert.equal(detail!.activity.reviewStatus, "HUMAN_REVIEW");

  const rows = await db.query<{ reviewed_by: string | null }>(
    `SELECT reviewed_by::text AS reviewed_by FROM activity WHERE id = $1::uuid`,
    [activityId],
  );
  assert.equal(rows.rows[0].reviewed_by, reviewerId);

  const history = await listReviewHistory(db, activityId);
  assert.equal(history.length, 1);
  assert.equal(history[0].fromStatus, "DRAFT");
  assert.equal(history[0].toStatus, "HUMAN_REVIEW");
  assert.equal(history[0].reviewerName, "Peninjau Uji");
});

// ---------- endpoint transisi ----------

test("11.11 endpoint: tanpa sesi → 401, lintas asal → 403", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const noSession = await postStatus(activityId, "HUMAN_REVIEW", {
    locals: { reviewerSession: undefined },
  });
  assert.equal(noSession.status, 401);
  assert.equal((await noSession.json()).error, "UNAUTHENTICATED");

  const crossOrigin = await postStatus(activityId, "HUMAN_REVIEW", {
    origin: "https://contoh-jahat.test",
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(await currentStatus(activityId), "DRAFT");
});

test("11.11 endpoint: alur penuh DRAFT → … → PUBLISHED tercatat di tiap langkah", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const chain = ["DRAFT", "HUMAN_REVIEW", "QA_APPROVED", "PUBLISHED"];
  for (let i = 1; i < chain.length; i++) {
    const from = chain[i - 1];
    const to = chain[i];
    const res = await postStatus(activityId, to, { notes: "diperiksa" });
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.reviewStatus, to);
    // Pesan memakai label teks (bukan kode status), lengkap dari → ke.
    assert.ok(
      body.message.includes(getReviewStatusLabel(from)) &&
        body.message.includes(getReviewStatusLabel(to)),
      body.message,
    );
    assert.equal(await currentStatus(activityId), to);
  }

  const history = await listReviewHistory(db, activityId);
  assert.deepEqual(
    history.map((h) => `${h.fromStatus}->${h.toStatus}`).reverse(),
    ["DRAFT->HUMAN_REVIEW", "HUMAN_REVIEW->QA_APPROVED", "QA_APPROVED->PUBLISHED"],
  );
  assert.ok(history.every((h) => h.reviewerName === "Peninjau Uji"));
  assert.ok(history.every((h) => h.notes === "diperiksa"));
});

test("11.13 endpoint: transisi di luar alur → 409 dan status tidak berubah", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const res = await postStatus(activityId, "PUBLISHED");
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "INVALID_TRANSITION");
  assert.ok(body.message.includes("tidak diizinkan"), body.message);
  assert.ok(body.message.includes("Kirim untuk review"), "pilihan sah ikut disebut");
  assert.equal(await currentStatus(activityId), "DRAFT");

  const unknown = await postStatus(activityId, "LIVE_NOW");
  assert.equal(unknown.status, 400);
  assert.equal(await currentStatus(activityId), "DRAFT");

  const same = await postStatus(activityId, "DRAFT");
  assert.equal(same.status, 409);
  assert.equal(await currentStatus(activityId), "DRAFT");
});

test("11.11 endpoint: catatan terlalu panjang → 400, tidak ada jejak tertulis", async () => {
  resetRateLimits();
  const activityId = await createDraft();

  const res = await postStatus(activityId, "HUMAN_REVIEW", {
    notes: "x".repeat(2001),
  });
  assert.equal(res.status, 400);
  assert.equal(await currentStatus(activityId), "DRAFT");
  const history = await listReviewHistory(db, activityId);
  assert.equal(history.length, 0);
});

test("11.11+11.13 jalur perbaikan konten terbit: tarik → edit → review lagi", async () => {
  resetRateLimits();
  const activityId = await createDraft();
  for (const to of ["HUMAN_REVIEW", "QA_APPROVED", "PUBLISHED"]) {
    assert.equal((await postStatus(activityId, to)).status, 200);
  }

  // Terbit: edit langsung tetap dikunci (OQ 24)
  const locked = await call(itemRoute.PUT, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, {
      method: "PUT",
      body: { ...tapPayload(), prompt: "Diedit diam-diam?" },
    }),
    params: { id: activityId },
    ...reviewerLocals,
  });
  assert.equal(locked.status, 409);

  // Tarik dari tayang → status UNPUBLISHED → edit diperbolehkan
  assert.equal((await postStatus(activityId, "UNPUBLISHED")).status, 200);
  const edit = await call(itemRoute.PUT, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, {
      method: "PUT",
      body: { ...tapPayload(), prompt: "Diperbaiki setelah ditinjau?" },
    }),
    params: { id: activityId },
    ...reviewerLocals,
  });
  assert.equal(edit.status, 200, await edit.clone().text());

  // Ajukan ulang → melewati QA sebelum terbit lagi
  assert.equal((await postStatus(activityId, "HUMAN_REVIEW")).status, 200);
  const premature = await postStatus(activityId, "PUBLISHED");
  assert.equal(premature.status, 409);
  assert.equal((await postStatus(activityId, "QA_APPROVED")).status, 200);
  assert.equal((await postStatus(activityId, "PUBLISHED")).status, 200);
  assert.equal(await currentStatus(activityId), "PUBLISHED");
});

test("11.11 GET detail menyertakan riwayat review untuk QA HTTP", async () => {
  resetRateLimits();
  const activityId = await createDraft();
  await postStatus(activityId, "HUMAN_REVIEW");

  const res = await call(itemRoute.GET, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`),
    params: { id: activityId },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.history));
  assert.equal(body.history.length, 1);
  assert.equal(body.history[0].toStatus, "HUMAN_REVIEW");
  assert.equal(body.history[0].reviewerName, "Peninjau Uji");
});

// ---------- berkas UI ----------

test("11.11 UI: panel alur review punya tombol transisi, live region, dan riwayat teks", async () => {
  const panel = await readFile(
    new URL("../src/components/ReviewFlowPanel.astro", import.meta.url),
    "utf8",
  );
  assert.ok(panel.includes("data-review-flow"));
  assert.ok(panel.includes("data-transition-to"));
  assert.ok(panel.includes("data-review-notes"));
  assert.ok(panel.includes('aria-live="polite"'));
  assert.ok(panel.includes("Riwayat review"));
  assert.ok(panel.includes("/api/reviewer/aktivitas/"), "kirim ke endpoint transisi");
  // Status selalu berupa teks, bukan warna saja.
  assert.ok(panel.includes("Status saat ini"));
  assert.ok(panel.includes("getReviewStatusLabel"));
  // Nilai visual hanya token: tanpa warna heksa dan tanpa durasi ms.
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(panel), "warna hardcoded di panel");
  assert.ok(!/\d+ms\b/.test(panel), "durasi ms hardcoded di panel");

  const edit = await readFile(
    new URL("../src/pages/reviewer/aktivitas/[id].astro", import.meta.url),
    "utf8",
  );
  assert.ok(edit.includes("ReviewFlowPanel"), "panel harus dipakai di layar detail");
  assert.ok(edit.includes("listReviewHistory"), "riwayat dibaca dari server");
});
