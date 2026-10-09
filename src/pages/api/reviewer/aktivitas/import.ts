/**
 * POST /api/reviewer/aktivitas/import — impor batch draf aktivitas
 * (VRD 12.1, 12.3–12.6).
 *
 * Pintu masuk tunggal konten AI ke aplikasi. Prinsipnya:
 *
 * - **Server sumber kebenaran**: seluruh batch divalidasi dulu
 *   (`parseDraftBatch` + `parseEditorPayload` per draf + resolusi
 *   `area_code`/`skill_code`) sebelum satu baris pun ditulis — bila satu
 *   draf gagal, seluruh batch ditolak dengan pesan bernomor draf (VRD 12.4),
 *   jadi tidak ada batch parsial.
 * - **Penandaan dipaksa**: setiap draf tersimpan dengan
 *   `content_origin = 'AI_DRAFT'` (VRD 12.5) dan `review_status = 'DRAFT'`.
 * - **Tidak ada penerbitan otomatis**: impor tidak pernah menyentuh
 *   `HUMAN_REVIEW`/`QA_APPROVED`/`PUBLISHED`; reviewer menjalankan transisi
 *   normal (VRD 11.11, PRD §7). Feed anak tertutup untuk konten non-published
 *   (VRD 11.14), jadi draf impor tidak pernah terlihat oleh anak.
 *
 * Pembangkit draf (VRD 12.2, provider/model) menunggu OQ 26 — endpoint ini
 * menerima batch JSON apa pun yang mengikuti `docs/AI-DRAFT-SCHEMA.md`
 * tanpa mengasumsikan penyedia tertentu.
 *
 * Rute berada di balik guard reviewer middleware (VRD 11.1).
 */
import type { APIRoute } from "astro";
import { getDb, type Db } from "../../../../lib/db/index.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  isSameOrigin,
} from "../../../../lib/auth/reviewer-http.ts";
import {
  checkRateLimit,
  RATE_LIMIT_KEYS,
} from "../../../../lib/auth/rate-limit.ts";
import {
  parseEditorPayload,
  replaceActivityOptions,
  replaceActivitySources,
  resolveSkillForArea,
  type EditorPayload,
} from "../../../../lib/activity/reviewer.ts";
import { parseDraftBatch, toEditorBody } from "../../../../lib/activity/ai-draft.ts";

/** Batch berisi banyak draf + sumber → batas di atas editor tunggal (32 KB). */
const IMPORT_MAX_BYTES = 512 * 1024;

/**
 * Resolusi `area_code`/`skill_code` ke UUID. Hasil di-cache per batch supaya
 * draf dengan area yang sama tidak memicu query ganda.
 */
function makeResolver(db: Db) {
  const areaCache = new Map<string, string | null>();
  const skillCache = new Map<string, string | null>();

  return {
    async areaId(code: string): Promise<string | null> {
      if (areaCache.has(code)) return areaCache.get(code) ?? null;
      const rows = await db.query<{ id: string }>(
        `SELECT id FROM learning_area WHERE code = $1 AND is_active = true`,
        [code],
      );
      const id = rows.rows[0]?.id ?? null;
      areaCache.set(code, id);
      return id;
    },
    async skillId(areaId: string, code: string): Promise<string | null> {
      const key = `${areaId}:${code}`;
      if (skillCache.has(key)) return skillCache.get(key) ?? null;
      const rows = await db.query<{ id: string }>(
        `SELECT id FROM skill WHERE learning_area_id = $1::uuid AND code = $2`,
        [areaId, code],
      );
      const id = rows.rows[0]?.id ?? null;
      skillCache.set(key, id);
      return id;
    },
  };
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "CROSS_ORIGIN", "Permintaan lintas-asal ditolak.");
  }

  const rl = checkRateLimit(request, RATE_LIMIT_KEYS.REVIEWER_WRITE);
  if (!rl.allowed) {
    return errorResponse(429, "RATE_LIMITED", "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const body = await readJsonBody(request, IMPORT_MAX_BYTES);
  if (!body) return errorResponse(400, "BAD_REQUEST", "Body tidak valid atau terlalu besar.");

  const parsed = parseDraftBatch(body);
  if (!parsed.ok) return errorResponse(400, "DRAFT_BATCH_INVALID", parsed.message);

  const db = await getDb();
  const resolve = makeResolver(db);
  const drafts = parsed.batch.drafts;

  // ---- Tahap 1: seluruh validasi & resolusi dulu, tanpa menulis apa pun ----
  const prepared: EditorPayload[] = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    const prefix = `Draf ke-${i + 1}: `;

    const learningAreaId = await resolve.areaId(draft.areaCode);
    if (!learningAreaId) {
      return errorResponse(
        400,
        "DRAFT_BATCH_INVALID",
        `${prefix}area_code '${draft.areaCode}' tidak dikenal atau tidak aktif.`,
      );
    }

    let skillId: string | null = null;
    if (draft.skillCode) {
      skillId = await resolve.skillId(learningAreaId, draft.skillCode);
      if (!skillId) {
        return errorResponse(
          400,
          "DRAFT_BATCH_INVALID",
          `${prefix}skill_code '${draft.skillCode}' tidak ada di area '${draft.areaCode}'.`,
        );
      }
    }

    // Validasi ulang lewat satu pintu validasi editor (VRD 11.2). Body sudah
    // dipaksa `content_origin: AI_DRAFT` oleh toEditorBody (VRD 12.5).
    const editor = parseEditorPayload(toEditorBody(draft, { learningAreaId, skillId }));
    if (!editor.ok) {
      return errorResponse(400, "DRAFT_BATCH_INVALID", prefix + editor.message);
    }

    // Pastikan area/skill masih sah di database; resolveSkillForArea juga
    // memilih skill pertama bila draf tidak menyebut skill_code.
    const resolved = await resolveSkillForArea(db, {
      learningAreaId,
      skillId: editor.payload.skillId,
    });
    if (!resolved.ok) {
      return errorResponse(400, "DRAFT_BATCH_INVALID", prefix + resolved.message);
    }

    prepared.push({ ...editor.payload, skillId: resolved.skillId });
  }

  // ---- Tahap 2: tulis — semua draf sudah lolos validasi ----
  const activityIds: string[] = [];
  for (const payload of prepared) {
    const created = await db.query<{ id: string }>(
      `INSERT INTO activity (
         skill_id, learning_area_id, target_age_min, target_age_max, difficulty,
         prompt, interaction_type, correct_answer, explanation, content_origin, review_status
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT')
       RETURNING id`,
      [
        payload.skillId,
        payload.learningAreaId,
        payload.targetAgeMin,
        payload.targetAgeMax,
        payload.difficulty,
        payload.prompt,
        payload.interactionType,
        JSON.stringify(payload.correctAnswer),
        payload.explanation,
        payload.contentOrigin,
      ],
    );

    const activityId = created.rows[0]?.id;
    if (!activityId) {
      return errorResponse(500, "SERVER_ERROR", "Gagal menyimpan salah satu draf.");
    }
    await replaceActivityOptions(db, activityId, payload.interactionType, payload.correctAnswer);
    await replaceActivitySources(db, activityId, payload.sources);
    activityIds.push(activityId);
  }

  return jsonResponse({
    ok: true,
    imported: activityIds.length,
    activityIds,
    contentOrigin: "AI_DRAFT",
    reviewStatus: "DRAFT",
    message: `${activityIds.length} draf tersimpan sebagai AI_DRAFT berstatus DRAFT — menunggu review manusia.`,
  });
};
