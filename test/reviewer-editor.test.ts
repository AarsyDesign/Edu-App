/**
 * Test Phase 11.2 — editor aktivitas reviewer.
 *
 * Menguji: parsing body editor (11.2–11.10), derivasi baris
 * `activity_option` dari payload, endpoint buat/ubah/hapus, gerbang status
 * (edit konten tayang ditolak, VRD 11.13), dan berkas UI editor/daftar.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const db = await getDb();
const {
  parseEditorPayload,
  deriveOptionRows,
  getReviewerActivityDetail,
} = await import("../src/lib/activity/reviewer.ts");
const { listLearningAreas, listAllSkillsWithArea } = await import(
  "../src/lib/learning/areas-skills.ts"
);
const { resetRateLimits } = await import("../src/lib/auth/rate-limit.ts");
const listRoute = await import("../src/pages/api/reviewer/aktivitas/index.ts");
const itemRoute = await import("../src/pages/api/reviewer/aktivitas/[id].ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";
const areas = await listLearningAreas(db);
const skills = await listAllSkillsWithArea(db);
const area = areas[0];
const skill = skills.find((s) => s.learningAreaId === area.areaId)!;

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
    sources: [
      {
        title: "Modul belajar anak",
        source_type: "Buku",
        reference_detail: "Bagian warna, halaman 12",
        methodology: null,
        is_disputed: false,
      },
    ],
    ...overrides,
  };
}

// ---------- parsing body editor ----------

test("11.2 parseEditorPayload: payload lengkap diterima, prompt di-trim", () => {
  const result = parseEditorPayload(tapPayload({ prompt: "  Mana yang merah?  " }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.prompt, "Mana yang merah?");
    assert.equal(result.payload.interactionType, "TAP_ANSWER");
    assert.equal(result.payload.correctAnswer.type, "tap_answer");
    assert.equal(result.payload.sources.length, 1);
  }
});

test("11.2 parseEditorPayload: pertanyaan kosong / tipe tak dikenal / usia terbalik ditolak", () => {
  const noPrompt = parseEditorPayload(tapPayload({ prompt: "   " }));
  assert.equal(noPrompt.ok, false);

  const badType = parseEditorPayload(
    tapPayload({ interaction_type: "DRAG_RAINBOW" }),
  );
  assert.equal(badType.ok, false);

  const reversedAge = parseEditorPayload(
    tapPayload({ target_age_min: 6, target_age_max: 4 }),
  );
  assert.equal(reversedAge.ok, false);

  const badOrigin = parseEditorPayload(tapPayload({ content_origin: "FROM_GOD" }));
  assert.equal(badOrigin.ok, false);
});

test("11.2 parseEditorPayload: payload jawaban tidak cocok dengan tipe ditolak", () => {
  const mismatch = parseEditorPayload(
    tapPayload({ interaction_type: "TRUE_FALSE" }),
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.match(mismatch.message, /tidak valid|type mismatch|wajib/i);
});

test("11.9 parseEditorPayload: sumber dengan judul kosong ditolak, sumber boleh kosong", () => {
  const emptyTitle = parseEditorPayload(
    tapPayload({
      sources: [
        { title: "", source_type: "Buku", reference_detail: "Halaman 1", methodology: null, is_disputed: false },
      ],
    }),
  );
  assert.equal(emptyTitle.ok, false);

  const noSources = parseEditorPayload(tapPayload({ sources: [] }));
  assert.equal(noSources.ok, true);
});

// ---------- derivasi activity_option ----------

test("11.7 deriveOptionRows: TAP_ANSWER menandai tepat satu baris benar", () => {
  const data = {
    type: "tap_answer" as const,
    items: [
      { id: "a", label: "Apel", isCorrect: true },
      { id: "b", label: "Pisang", isCorrect: false },
    ],
  };
  const rows = deriveOptionRows("TAP_ANSWER", data);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.isCorrect),
    [true, false],
  );
  assert.equal(rows[0].payload.label, "Apel");
});

test("11.7 deriveOptionRows: SEQUENCE diurutkan menurut posisi benar", () => {
  const rows = deriveOptionRows("SEQUENCE", {
    type: "sequence",
    items: [
      { id: "s1", label: "Bangun", correctPosition: 1 },
      { id: "s2", label: "Shalat", correctPosition: 0 },
    ],
  });
  assert.deepEqual(
    rows.map((r) => r.payload.label),
    ["Shalat", "Bangun"],
  );
  assert.ok(rows.every((r) => r.isCorrect === false));
});

test("11.7 deriveOptionRows: MATCH dan TRUE_FALSE tidak menghasilkan baris opsi", () => {
  assert.deepEqual(
    deriveOptionRows("MATCH", {
      type: "match",
      left: [{ id: "l1", label: "A" }],
      right: [{ id: "r1", label: "1" }],
      correctPairs: { l1: "r1" },
    }),
    [],
  );
  assert.deepEqual(
    deriveOptionRows("TRUE_FALSE", {
      type: "true_false",
      statement: "Langit biru",
      correctAnswer: true,
    }),
    [],
  );
});

// ---------- endpoint: buat ----------

test("11.2 POST /api/reviewer/aktivitas: lahir sebagai DRAFT + opsi + sumber tersimpan", async () => {
  resetRateLimits();
  const res = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload() }),
  });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.reviewStatus, "DRAFT");

  const detail = await getReviewerActivityDetail(db, body.activityId);
  assert.ok(detail, "aktivitas harus bisa dibuka lagi");
  assert.equal(detail!.activity.reviewStatus, "DRAFT");
  assert.equal(detail!.activity.skillId, skill.skillId);
  assert.equal(detail!.options.length, 2);
  assert.equal(detail!.options.filter((o) => o.isCorrect).length, 1);
  assert.equal(detail!.sources.length, 1);
  assert.equal(detail!.sources[0].sourceType, "Buku");

  // Jejak review TIDAK dicatat untuk sekadar membuat draf: tabel content_review
  // mewajibkan from <> to, dan mencatat "DRAFT → DRAFT" akan menyamar review.
  const trails = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM content_review WHERE activity_id = $1::uuid`,
    [body.activityId],
  );
  assert.equal(Number(trails.rows[0].count), 0);
});

test("11.2 POST: body tidak valid → 400 dengan pesan berbahasa Indonesia", async () => {
  const res = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", {
      body: tapPayload({ prompt: "" }),
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "BAD_REQUEST");
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("11.1 POST: permintaan lintas asal → 403", async () => {
  const res = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", {
      body: tapPayload(),
      origin: "https://contoh-jahat.test",
    }),
  });
  assert.equal(res.status, 403);
});

// ---------- endpoint: daftar & detail ----------

test("11.2 GET daftar: mengembalikan aktivitas + paginasi + filter status", async () => {
  const res = await call(listRoute.GET, {
    request: makeRequest("/api/reviewer/aktivitas?status=DRAFT&limit=5"),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.activities.length >= 1);
  assert.ok(body.activities.every((a: { reviewStatus: string }) => a.reviewStatus === "DRAFT"));
  assert.equal(body.pagination.limit, 5);
  assert.ok(body.pagination.total >= body.activities.length);

  const filtered = await call(listRoute.GET, {
    request: makeRequest("/api/reviewer/aktivitas?status=PUBLISHED"),
  });
  const publishedBody = await filtered.json();
  assert.ok(
    publishedBody.activities.every(
      (a: { reviewStatus: string }) => a.reviewStatus === "PUBLISHED",
    ),
  );
});

test("11.9 GET detail: opsi dan sumber ikut dikembalikan; id asing → 404", async () => {
  const list = await call(listRoute.GET, {
    request: makeRequest("/api/reviewer/aktivitas?limit=1"),
  });
  const { activities } = await list.json();
  const res = await call(itemRoute.GET, {
    request: makeRequest(`/api/reviewer/aktivitas/${activities[0].id}`),
    params: { id: activities[0].id },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.activity.prompt.length > 0);
  assert.ok(Array.isArray(body.options));
  assert.ok(Array.isArray(body.sources));

  const missing = await call(itemRoute.GET, {
    request: makeRequest("/api/reviewer/aktivitas/00000000-0000-4000-8000-000000000000"),
    params: { id: "00000000-0000-4000-8000-000000000000" },
  });
  assert.equal(missing.status, 404);
});

// ---------- endpoint: ubah & hapus ----------

test("11.2 PUT: prompt berubah, versi naik, status tetap DRAFT", async () => {
  const created = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload() }),
  });
  const { activityId } = await created.json();

  const res = await call(itemRoute.PUT, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, {
      method: "PUT",
      body: tapPayload({ prompt: "Mana yang kuning?" }),
    }),
    params: { id: activityId },
  });
  assert.equal(res.status, 200, await res.clone().text());

  const detail = await getReviewerActivityDetail(db, activityId);
  assert.equal(detail!.activity.prompt, "Mana yang kuning?");
  assert.equal(detail!.activity.reviewStatus, "DRAFT");
  assert.equal(detail!.activity.version, 2);
  assert.equal(detail!.options.length, 2);
});

test("11.13 PUT: konten berstatus PUBLISHED dikunci (persetujuan tidak bisa dilewati)", async () => {
  const created = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload() }),
  });
  const { activityId } = await created.json();

  await db.query(
    `UPDATE activity SET review_status = 'PUBLISHED' WHERE id = $1::uuid`,
    [activityId],
  );

  const res = await call(itemRoute.PUT, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, {
      method: "PUT",
      body: tapPayload({ prompt: "Diedit diam-diam?" }),
    }),
    params: { id: activityId },
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error, "STATUS_LOCKED");

  const detail = await getReviewerActivityDetail(db, activityId);
  assert.equal(detail!.activity.prompt, "Mana yang berwarna merah?");
});

test("11.13 DELETE: DRAFT bisa dihapus, yang terbit tidak", async () => {
  const created = await call(listRoute.POST, {
    request: makeRequest("/api/reviewer/aktivitas", { body: tapPayload() }),
  });
  const { activityId } = await created.json();

  await db.query(`UPDATE activity SET review_status = 'PUBLISHED' WHERE id = $1::uuid`, [
    activityId,
  ]);
  const locked = await call(itemRoute.DELETE, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, { method: "DELETE" }),
    params: { id: activityId },
  });
  assert.equal(locked.status, 400);

  await db.query(`UPDATE activity SET review_status = 'DRAFT' WHERE id = $1::uuid`, [
    activityId,
  ]);
  const deleted = await call(itemRoute.DELETE, {
    request: makeRequest(`/api/reviewer/aktivitas/${activityId}`, { method: "DELETE" }),
    params: { id: activityId },
  });
  assert.equal(deleted.status, 200);
  const gone = await getReviewerActivityDetail(db, activityId);
  assert.equal(gone, null);

  // Opsi & sumber ikut terhapus (FK cascade)
  const leftover = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM content_source WHERE activity_id = $1::uuid`,
    [activityId],
  );
  assert.equal(Number(leftover.rows[0].count), 0);
});

// ---------- gerbang rute (regresi QA E2E 11.2) ----------

test("11.1 gerbang: halaman & endpoint login publik, sisanya terlindungi", async () => {
  const guard = await import("../src/lib/auth/reviewer-guard.ts");

  assert.equal(guard.isReviewerProtectedPath("/reviewer/login"), false);
  assert.equal(guard.isReviewerProtectedPath("/reviewer/login?next=1"), false);
  assert.equal(guard.isReviewerProtectedPath("/api/reviewer/auth/login"), false);

  assert.equal(guard.isReviewerProtectedPath("/reviewer"), true);
  assert.equal(guard.isReviewerProtectedPath("/reviewer/aktivitas"), true);
  assert.equal(guard.isReviewerProtectedPath("/api/reviewer/aktivitas"), true);
  assert.equal(guard.isReviewerProtectedPath("/api/reviewer/auth/logout"), true);
});

// ---------- berkas UI ----------

test("11.2 UI: formulir editor punya panel tiap tipe, status review, dan pengiriman JSON", async () => {
  const form = await readFile(
    new URL("../src/components/ActivityEditorForm.astro", import.meta.url),
    "utf8",
  );

  assert.ok(form.includes('data-activity-editor'));
  for (const panel of [
    "TAP_ANSWER",
    "COUNT_OBJECTS",
    "MATCH",
    "SEQUENCE",
    "IDENTIFY_COLOR",
    "IDENTIFY_SHAPE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
  ]) {
    assert.ok(form.includes(`data-type-panel="${panel}"`), `panel ${panel} hilang`);
  }

  // 11.3–11.10: seluruh bagian wujud di formulir
  assert.ok(form.includes("data-area-select"), "pemilih area belajar");
  assert.ok(form.includes('id="age-min"') && form.includes('id="age-max"'), "rentang usia");
  assert.ok(form.includes('id="difficulty"'), "kesukaran");
  assert.ok(form.includes("data-type-select"), "tipe interaksi");
  assert.ok(form.includes("data-source-row"), "sumber rujukan");
  assert.ok(form.includes('id="content-origin"'), "asal konten");
  assert.ok(form.includes("data-review-status"), "status review");

  // Status ditampilkan sebagai teks, bukan hanya warna.
  assert.ok(form.includes("aria-live"));
  assert.ok(form.includes('data-tone'));

  // Nilai visual lewat token: tidak ada warna heksa di komponen (satu-satunya
  // literal `#174a3a` adalah benih input warna = isi konten, bukan gaya).
  const hex = form.replace(/#174a3a/g, "");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(hex), "warna hardcoded di komponen");
  // Durasi animasi hanya lewat token durasi; ada override reduced-motion.
  assert.ok(!/\d+ms\b/.test(form), "durasi ms hardcoded di komponen");
  assert.ok(form.includes("prefers-reduced-motion"));
});

test("11.2 UI: daftar aktivitas punya saringan, label status teks, dan tautan edit", async () => {
  const page = await readFile(
    new URL("../src/pages/reviewer/aktivitas/index.astro", import.meta.url),
    "utf8",
  );
  assert.ok(page.includes('id="filter-area"'));
  assert.ok(page.includes('id="filter-status"'));
  assert.ok(page.includes("getReviewStatusLabel"), "status harus berupa teks");
  assert.ok(page.includes('href={`/reviewer/aktivitas/${activity.id}`}'));
  assert.ok(page.includes("/reviewer/aktivitas/baru"));

  const create = await readFile(
    new URL("../src/pages/reviewer/aktivitas/baru.astro", import.meta.url),
    "utf8",
  );
  assert.ok(create.includes("ActivityEditorForm"));
  assert.ok(create.includes('mode="create"'));

  const edit = await readFile(
    new URL("../src/pages/reviewer/aktivitas/[id].astro", import.meta.url),
    "utf8",
  );
  assert.ok(edit.includes('mode="edit"'));
  assert.ok(edit.includes("EDITABLE_REVIEW_STATUSES"), "gerbang status harus ada di layar edit");
  assert.ok(edit.includes("buildActivityData"), "payload edit dirakit seperti produksi");
});
