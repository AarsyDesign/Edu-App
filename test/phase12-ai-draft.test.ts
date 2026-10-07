/**
 * Test Phase 12.1/12.3–12.6 — skema draf aktivitas + impor batch.
 *
 * Menguji: amplop batch & validasi per draf (skema 12.1, 12.3), penolakan
 * draf rusak tanpa menulis apa pun (12.4), penandaan `content_origin =
 * 'AI_DRAFT'` yang dipaksa (12.5), endpoint impor yang menyimpan batch
 * sebagai `DRAFT` untuk antrean review manusia (12.6), serta gerbang
 * (origin, resolusi kode area/skill).
 *
 * VRD 12.2 (pembangkit batch) sengaja tidak diuji — provider menunggu OQ 26.
 *
 * Database in-memory bersih per file test.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

// Harus disetel SEBELUM modul db diimpor (dynamic import di bawah).
process.env.PGLITE_MODE = "memory";

const { getDb, closeDb } = await import("../src/lib/db/index.ts");
const db = await getDb();
const { parseDraftBatch, toEditorBody, AI_DRAFT_SCHEMA_VERSION, DRAFT_BATCH_MAX } = await import(
  "../src/lib/activity/ai-draft.ts"
);
const { parseEditorPayload } = await import("../src/lib/activity/reviewer.ts");
const { activityTestFixtures } = await import("../src/lib/activity/domain.ts");
const { listLearningAreas, listAllSkillsWithArea } = await import(
  "../src/lib/learning/areas-skills.ts"
);
const { resetRateLimits } = await import("../src/lib/auth/rate-limit.ts");
const importRoute = await import("../src/pages/api/reviewer/aktivitas/import.ts");

after(async () => {
  await closeDb();
});

const ORIGIN = "http://localhost:4321";
const areas = await listLearningAreas(db);
const skills = await listAllSkillsWithArea(db);
const area = areas[0];
const skill = skills.find((s) => s.learningAreaId === area.areaId)!;

function makeRequest(path: string, body: unknown, origin = ORIGIN): Request {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("origin", origin);
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(handler: any, request: Request): Promise<Response> {
  return handler({ request });
}

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    area_code: area.code,
    skill_code: skill.code,
    prompt: "Mana yang berwarna merah?",
    interaction_type: "TAP_ANSWER",
    target_age_min: 3,
    target_age_max: 5,
    difficulty: 1,
    correct_answer: activityTestFixtures.TAP_ANSWER,
    explanation: "Apel berwarna merah.",
    ...overrides,
  };
}

function batch(drafts: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { schema_version: AI_DRAFT_SCHEMA_VERSION, drafts, ...extra };
}

async function activityCount(): Promise<number> {
  const rows = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM activity`);
  return rows.rows[0]?.n ?? 0;
}

// ---------- 12.1 + 12.3: amplop batch ----------

test("12.1 amplop: batch bukan objek / schema_version salah / drafts kosong ditolak", () => {
  assert.equal(parseDraftBatch(null).ok, false);
  assert.equal(parseDraftBatch([draft()]).ok, false);

  const wrongVersion = parseDraftBatch(batch([draft()], { schema_version: 2 }));
  assert.equal(wrongVersion.ok, false);
  if (!wrongVersion.ok) assert.match(wrongVersion.message, /schema_version/);

  const noDrafts = parseDraftBatch({ schema_version: AI_DRAFT_SCHEMA_VERSION });
  assert.equal(noDrafts.ok, false);

  const empty = parseDraftBatch(batch([]));
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.message, /tidak berisi draf/);
});

test("12.1 amplop: batch lebih dari batas ditolak, model wajib teks", () => {
  const tooMany = parseDraftBatch(
    batch(Array.from({ length: DRAFT_BATCH_MAX + 1 }, () => draft())),
  );
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.match(tooMany.message, /maksimal 25 draf/);

  const badModel = parseDraftBatch(batch([draft()], { model: 12345 }));
  assert.equal(badModel.ok, false);
  if (!badModel.ok) assert.match(badModel.message, /model/);
});

// ---------- 12.3 + 12.4: validasi per draf ----------

test("12.4 draf rusak ditolak dengan nomor drafnya", () => {
  const cases: Array<{ overrides: Record<string, unknown>; pattern: RegExp }> = [
    { overrides: { interaction_type: "DRAG_RAINBOW" }, pattern: /interaction_type/ },
    { overrides: { area_code: "Belum Ada" }, pattern: /area_code/ },
    { overrides: { skill_code: "Skill-Salah" }, pattern: /skill_code/ },
    { overrides: { prompt: "" }, pattern: /prompt/ },
    { overrides: { prompt: "x".repeat(501) }, pattern: /prompt maksimal 500/ },
    { overrides: { target_age_min: 8 }, pattern: /target_age_min/ },
    { overrides: { target_age_min: 6, target_age_max: 4 }, pattern: /melebihi/ },
    { overrides: { difficulty: 0 }, pattern: /difficulty/ },
    { overrides: { correct_answer: { type: "tap_answer", items: [] } }, pattern: /correct_answer/ },
    { overrides: { sources: [{ title: "Tapi" }] }, pattern: /sumber/ },
  ];

  for (const { overrides, pattern } of cases) {
    const result = parseDraftBatch(batch([draft(), draft(overrides)]));
    assert.equal(result.ok, false, `seharusnya ditolak: ${JSON.stringify(overrides)}`);
    if (!result.ok) {
      assert.match(result.message, /^Draf ke-2:/, result.message);
      assert.match(result.message, pattern, result.message);
    }
  }
});

test("12.3 semua tipe aktivitas lolos skema (fixture VRD 6.15)", () => {
  const types = Object.keys(activityTestFixtures) as Array<keyof typeof activityTestFixtures>;
  const drafts = types.map((type) =>
    draft({ interaction_type: type, correct_answer: activityTestFixtures[type] }),
  );
  const result = parseDraftBatch(batch(drafts));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.batch.drafts.length, types.length);
    assert.equal(
      result.batch.drafts.every((d, i) => d.interactionType === types[i]),
      true,
    );
    assert.equal(result.batch.model, null);
  }
});

test("12.3 skill_code opsional boleh kosong, model & prompt_version terbaca", () => {
  const result = parseDraftBatch(
    batch([draft({ skill_code: null })], { model: "model-uji", prompt_version: "v1" }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.batch.drafts[0].skillCode, null);
    assert.equal(result.batch.model, "model-uji");
    assert.equal(result.batch.promptVersion, "v1");
  }
});

// ---------- 12.5: penandaan AI_DRAFT ----------

test("12.5 toEditorBody selalu menandai AI_DRAFT dan lolos parseEditorPayload", () => {
  const parsed = parseDraftBatch(
    batch([draft({ content_origin: "HUMAN_CREATED", sources: [] })]),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const body = toEditorBody(parsed.batch.drafts[0], {
    learningAreaId: area.areaId,
    skillId: skill.skillId,
  });
  assert.equal(body.content_origin, "AI_DRAFT");

  const editor = parseEditorPayload(body);
  assert.equal(editor.ok, true);
  if (editor.ok) assert.equal(editor.payload.contentOrigin, "AI_DRAFT");
});

// ---------- 12.6: endpoint impor ----------

test("12.6 impor batch valid → 200, semua tersimpan AI_DRAFT + DRAFT", async () => {
  resetRateLimits();
  const before = await activityCount();
  const body = batch([
    draft(),
    draft({
      skill_code: null,
      prompt: "Ada berapa bintang?",
      interaction_type: "COUNT_OBJECTS",
      correct_answer: activityTestFixtures.COUNT_OBJECTS,
    }),
  ]);

  const response = await call(importRoute.POST, makeRequest("/api/reviewer/aktivitas/import", body));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.imported, 2);
  assert.equal(data.contentOrigin, "AI_DRAFT");
  assert.equal(data.reviewStatus, "DRAFT");

  const rows = await db.query<{ content_origin: string; review_status: string; id: string }>(
    `SELECT id, content_origin, review_status FROM activity
      WHERE id = ANY($1::uuid[])`,
    [data.activityIds],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(
    rows.rows.every((r) => r.content_origin === "AI_DRAFT" && r.review_status === "DRAFT"),
    true,
  );

  // Baris opsi ikut tertulis (jalur 2 pembacaan CONTENT-SPEC §7.2).
  const options = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM activity_option WHERE activity_id = $1::uuid`,
    [data.activityIds[0]],
  );
  assert.ok((options.rows[0]?.n ?? 0) >= 2, "TAP_ANSWER minimal dua baris opsi");

  assert.equal(await activityCount(), before + 2);
});

test("12.4 endpoint menolak batch satu draf rusak tanpa menulis apa pun", async () => {
  resetRateLimits();
  const before = await activityCount();
  const body = batch([
    draft({ prompt: "Draf pertama yang sah." }),
    draft({ target_age_max: 9 }),
  ]);

  const response = await call(importRoute.POST, makeRequest("/api/reviewer/aktivitas/import", body));
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error, "DRAFT_BATCH_INVALID");
  assert.match(data.message, /^Draf ke-2:/);

  assert.equal(await activityCount(), before, "tidak boleh ada batch setengah jadi");
});

test("12.3 endpoint: area_code tak dikenal & skill_code bukan milik area ditolak", async () => {
  resetRateLimits();
  const before = await activityCount();

  const unknownArea = await call(
    importRoute.POST,
    makeRequest("/api/reviewer/aktivitas/import", batch([draft({ area_code: "kosong" })])),
  );
  assert.equal(unknownArea.status, 400);
  const areaData = await unknownArea.json();
  assert.match(areaData.message, /area_code 'kosong' tidak dikenal/);

  // Skill dari area lain: valid sebagai kode, tapi bukan milik area draf.
  const foreignSkill = skills.find((s) => s.learningAreaCode !== area.code)!;
  const wrongSkill = await call(
    importRoute.POST,
    makeRequest(
      "/api/reviewer/aktivitas/import",
      batch([draft({ skill_code: foreignSkill.code })]),
    ),
  );
  assert.equal(wrongSkill.status, 400);
  const skillData = await wrongSkill.json();
  assert.match(skillData.message, /skill_code/);

  assert.equal(await activityCount(), before);
});

test("12.6 gerbang: lintas asal ditolak & schema_version salah ditolak", async () => {
  resetRateLimits();

  const cross = await call(
    importRoute.POST,
    makeRequest("/api/reviewer/aktivitas/import", batch([draft()]), "https://contoh-asing.test"),
  );
  assert.equal(cross.status, 403);

  const wrongSchema = await call(
    importRoute.POST,
    makeRequest("/api/reviewer/aktivitas/import", batch([draft()], { schema_version: 99 })),
  );
  assert.equal(wrongSchema.status, 400);
  const data = await wrongSchema.json();
  assert.equal(data.error, "DRAFT_BATCH_INVALID");
});
