/**
 * Konten reviewer (VRD 11.2–11.10).
 *
 * Modul ini memegang tiga hal yang dipakai endpoint dan halaman editor:
 *
 * 1. `parseEditorPayload` — satu pintu validasi untuk body editor (buat &
 *    ubah), supaya aturan yang sama berlaku di dua handler dan tidak ada
 *    field yang lolos tanpa diperiksa.
 * 2. `deriveOptionRows` — membalik pemetaan `content.ts`: dari objek
 *    `ActivityData` (jalur 1 pembacaan) dihasilkan baris `activity_option`
 *    sesuai konvensi skema ("untuk tipe berbasis pilihan, kebenaran ditandai
 *    di activity_option.is_correct"), sehingga kedua jalur pembacaan selalu
 *    konsisten.
 * 3. Query daftar/detail untuk halaman `/reviewer/aktivitas`.
 *
 * Status review TIDAK diubah di sini: transisi status hanya lewat jejak
 * `content_review` (CHECK `from <> to`) pada VRD 11.11/11.13 — mencatat
 * "DRAFT → DRAFT" akan melanggar constraint dan menyamar sebagai review.
 */
import type { Db } from "../db/index.ts";
import {
  validateActivityData,
  type ActivityData,
  type ActivityType,
} from "./domain.ts";

// ============================================================
// Enum & label
// ============================================================

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  "TAP_ANSWER",
  "COUNT_OBJECTS",
  "MATCH",
  "SEQUENCE",
  "IDENTIFY_COLOR",
  "IDENTIFY_SHAPE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
] as const;

export const CONTENT_ORIGINS = [
  "HUMAN_CREATED",
  "AI_ASSISTED",
  "AI_DRAFT",
  "COMMUNITY_CREATED",
] as const;

export const REVIEW_STATUSES = [
  "DRAFT",
  "HUMAN_REVIEW",
  "QA_APPROVED",
  "PUBLISHED",
  "FLAGGED",
  "UNPUBLISHED",
] as const;

const REVIEW_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  HUMAN_REVIEW: "Menunggu review",
  QA_APPROVED: "Lulus QA",
  PUBLISHED: "Terbit",
  FLAGGED: "Ditandai",
  UNPUBLISHED: "Tidak terbit",
};

const CONTENT_ORIGIN_LABELS: Record<string, string> = {
  HUMAN_CREATED: "Dibuat manual",
  AI_ASSISTED: "Dibantu AI",
  AI_DRAFT: "Draf AI",
  COMMUNITY_CREATED: "Dari komunitas",
};

export function getReviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function getContentOriginLabel(origin: string): string {
  return CONTENT_ORIGIN_LABELS[origin] ?? origin;
}

// ============================================================
// Parsing body editor
// ============================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROMPT_MAX = 500;
const EXPLANATION_MAX = 1000;
const SOURCES_MAX = 5;

export interface SourceInput {
  title: string;
  sourceType: string;
  referenceDetail: string;
  methodology: string | null;
  isDisputed: boolean;
}

export interface EditorPayload {
  prompt: string;
  interactionType: ActivityType;
  learningAreaId: string;
  skillId: string | null;
  targetAgeMin: number;
  targetAgeMax: number;
  difficulty: number;
  correctAnswer: ActivityData;
  explanation: string | null;
  contentOrigin: (typeof CONTENT_ORIGINS)[number];
  sources: SourceInput[];
}

export type ParsedPayload =
  | { ok: true; payload: EditorPayload }
  | { ok: false; message: string };

function fail(message: string): ParsedPayload {
  return { ok: false, message };
}

function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

/**
 * Validasi body editor. Berlaku penuh untuk POST (semua field wajib) dan
 * untuk PUT — formulir selalu mengirim isi lengkap, jadi ubah = ganti semua
 * field yang bisa diedit (review_status tidak pernah ikut diubah).
 */
export function parseEditorPayload(body: Record<string, unknown>): ParsedPayload {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return fail("Pertanyaan wajib diisi.");
  if (prompt.length > PROMPT_MAX) {
    return fail(`Pertanyaan maksimal ${PROMPT_MAX} karakter.`);
  }

  const interactionType =
    typeof body.interaction_type === "string" ? body.interaction_type.toUpperCase() : "";
  if (!(ACTIVITY_TYPES as readonly string[]).includes(interactionType)) {
    return fail("Tipe interaksi tidak dikenal.");
  }
  const type = interactionType as ActivityType;

  const learningAreaId =
    typeof body.learning_area_id === "string" ? body.learning_area_id : "";
  if (!UUID_RE.test(learningAreaId)) return fail("Area belajar tidak valid.");

  let skillId: string | null = null;
  if (body.skill_id !== undefined && body.skill_id !== null && body.skill_id !== "") {
    if (typeof body.skill_id !== "string" || !UUID_RE.test(body.skill_id)) {
      return fail("Skill tidak valid.");
    }
    skillId = body.skill_id;
  }

  const targetAgeMin = intInRange(body.target_age_min, 3, 7);
  if (targetAgeMin === null) return fail("Usia minimal harus bilangan bulat 3–7.");
  const targetAgeMax = intInRange(body.target_age_max, 3, 7);
  if (targetAgeMax === null) return fail("Usia maksimal harus bilangan bulat 3–7.");
  if (targetAgeMin > targetAgeMax) {
    return fail("Usia minimal tidak boleh melebihi usia maksimal.");
  }

  const difficulty = intInRange(body.difficulty, 1, 3);
  if (difficulty === null) return fail("Kesukaran harus 1–3.");

  const correctAnswer = body.correct_answer;
  if (!correctAnswer || typeof correctAnswer !== "object" || Array.isArray(correctAnswer)) {
    return fail("Jawaban benar wajib diisi sesuai tipe interaksi.");
  }
  let validated: ActivityData;
  try {
    validated = validateActivityData(type, correctAnswer);
  } catch (error) {
    return fail(`Jawaban benar tidak valid: ${(error as Error).message}`);
  }

  let explanation: string | null = null;
  if (body.explanation !== undefined && body.explanation !== null && body.explanation !== "") {
    if (typeof body.explanation !== "string") return fail("Penjelasan harus teks.");
    explanation = body.explanation.trim();
    if (explanation.length > EXPLANATION_MAX) {
      return fail(`Penjelasan maksimal ${EXPLANATION_MAX} karakter.`);
    }
    if (explanation === "") explanation = null;
  }

  const contentOrigin =
    typeof body.content_origin === "string" ? body.content_origin.toUpperCase() : "HUMAN_CREATED";
  if (!(CONTENT_ORIGINS as readonly string[]).includes(contentOrigin)) {
    return fail("Asal konten tidak valid.");
  }

  const sources: SourceInput[] = [];
  if (body.sources !== undefined && body.sources !== null) {
    if (!Array.isArray(body.sources)) return fail("Sumber harus berupa daftar.");
    if (body.sources.length > SOURCES_MAX) {
      return fail(`Maksimal ${SOURCES_MAX} sumber per aktivitas.`);
    }
    for (const raw of body.sources) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fail("Ada sumber yang tidak valid.");
      }
      const item = raw as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const sourceType = typeof item.source_type === "string" ? item.source_type.trim() : "";
      const referenceDetail =
        typeof item.reference_detail === "string" ? item.reference_detail.trim() : "";
      if (!title || title.length > 300) return fail("Judul sumber wajib diisi (maks 300 karakter).");
      if (!sourceType || sourceType.length > 60) {
        return fail("Jenis sumber wajib diisi (maks 60 karakter).");
      }
      if (!referenceDetail || referenceDetail.length > 2000) {
        return fail("Rujukan sumber wajib diisi (maks 2000 karakter).");
      }
      let methodology: string | null = null;
      if (typeof item.methodology === "string" && item.methodology.trim() !== "") {
        methodology = item.methodology.trim();
        if (methodology.length > 2000) return fail("Metode peninjauan maksimal 2000 karakter.");
      }
      sources.push({
        title,
        sourceType,
        referenceDetail,
        methodology,
        isDisputed: item.is_disputed === true,
      });
    }
  }

  return {
    ok: true,
    payload: {
      prompt,
      interactionType: type,
      learningAreaId,
      skillId,
      targetAgeMin,
      targetAgeMax,
      difficulty,
      correctAnswer: validated,
      explanation,
      contentOrigin: contentOrigin as EditorPayload["contentOrigin"],
      sources,
    },
  };
}

// ============================================================
// Derivasi baris activity_option
// ============================================================

export interface DerivedOption {
  payload: Record<string, unknown>;
  isCorrect: boolean;
}

/**
 * Hasilkan baris `activity_option` dari `ActivityData` yang sudah tervalidasi.
 *
 * - Pilihan (TAP_ANSWER, MULTIPLE_CHOICE, IDENTIFY_COLOR, IDENTIFY_SHAPE):
 *   `is_correct` ditandai persis seperti pada payload, sesuai konvensi skema.
 * - SEQUENCE: urutan baris = `correctPosition` (isi `position` saat tulis),
 *   supaya jalur perakitan `content.ts` menghasilkan posisi yang sama.
 * - COUNT_OBJECTS: objek disimpan tanpa tanda benar — kebenaran ada di
 *   `correct_answer.correctAnswer`.
 * - MATCH: sengaja kosong — `content.ts` tidak pernah merakit MATCH dari
 *   baris opsi (pemetaan pasangan tidak terbaca dari skema).
 * - TRUE_FALSE: tanpa baris opsi; jawabannya boolean di `correct_answer`.
 */
export function deriveOptionRows(type: ActivityType, data: ActivityData): DerivedOption[] {
  switch (type) {
    case "TAP_ANSWER": {
      const d = data as Extract<ActivityData, { type: "tap_answer" }>;
      return d.items.map((item) => ({
        payload: {
          label: item.label,
          ...(typeof item.value === "string" ? { value: item.value } : {}),
        },
        isCorrect: item.isCorrect,
      }));
    }
    case "MULTIPLE_CHOICE": {
      const d = data as Extract<ActivityData, { type: "multiple_choice" }>;
      return d.options.map((opt) => ({
        payload: { label: opt.label },
        isCorrect: opt.isCorrect,
      }));
    }
    case "IDENTIFY_COLOR": {
      const d = data as Extract<ActivityData, { type: "identify_color" }>;
      return d.options.map((opt) => ({
        payload: { colorValue: opt.colorValue, colorName: opt.colorName },
        isCorrect: opt.isCorrect,
      }));
    }
    case "IDENTIFY_SHAPE": {
      const d = data as Extract<ActivityData, { type: "identify_shape" }>;
      return d.options.map((opt) => ({
        payload: { shapeKey: opt.shapeKey, shapeName: opt.shapeName },
        isCorrect: opt.isCorrect,
      }));
    }
    case "COUNT_OBJECTS": {
      const d = data as Extract<ActivityData, { type: "count_objects" }>;
      return d.objects.map((obj) => ({
        payload: { visualKey: obj.visualKey, count: obj.count },
        isCorrect: false,
      }));
    }
    case "SEQUENCE": {
      const d = data as Extract<ActivityData, { type: "sequence" }>;
      return [...d.items]
        .sort((a, b) => a.correctPosition - b.correctPosition)
        .map((item) => ({
          payload: {
            label: item.label,
            ...(typeof item.visualKey === "string" ? { visualKey: item.visualKey } : {}),
          },
          isCorrect: false,
        }));
    }
    case "MATCH":
    case "TRUE_FALSE":
    default:
      return [];
  }
}

// ============================================================
// Resolusi area & skill
// ============================================================

export type SkillResolution =
  | { ok: true; skillId: string }
  | { ok: false; message: string };

/**
 * Pastikan area belajar aktif dan skill yang dipakai benar-benar milik area
 * itu. Tanpa `skillId` dipilih skill pertama area (urut `sort_order`) —
 * editor selalu mengirim skill, fallback ini untuk pemanggil API lain.
 */
export async function resolveSkillForArea(
  db: Db,
  input: { learningAreaId: string; skillId: string | null },
): Promise<SkillResolution> {
  const area = await db.query<{ id: string }>(
    `SELECT id FROM learning_area WHERE id = $1::uuid AND is_active = true`,
    [input.learningAreaId],
  );
  if (area.rows.length === 0) {
    return { ok: false, message: "Area belajar tidak ditemukan atau tidak aktif." };
  }

  if (input.skillId) {
    const skill = await db.query<{ id: string }>(
      `SELECT id FROM skill WHERE id = $1::uuid AND learning_area_id = $2::uuid`,
      [input.skillId, input.learningAreaId],
    );
    if (skill.rows.length === 0) {
      return { ok: false, message: "Skill tidak termasuk dalam area belajar itu." };
    }
    return { ok: true, skillId: skill.rows[0].id };
  }

  const skill = await db.query<{ id: string }>(
    `SELECT id FROM skill
      WHERE learning_area_id = $1::uuid
      ORDER BY sort_order ASC, id ASC
      LIMIT 1`,
    [input.learningAreaId],
  );
  if (skill.rows.length === 0) {
    return {
      ok: false,
      message: "Area belajar belum punya skill. Pilih area lain atau tambah skill dulu.",
    };
  }
  return { ok: true, skillId: skill.rows[0].id };
}

/**
 * Status yang boleh diedit langsung.
 *
 * Konten yang sedang dalam alur review (HUMAN_REVIEW, QA_APPROVED) atau sedang
 * tayang (PUBLISHED) dikunci: mengubahnya diam-diam akan melewati gerbang
 * persetujuan (PRD §7, VRD 11.13). Status ini tidak mengubah `review_status`
 * apa pun — perpindahan status hanya lewat jejak `content_review`.
 */
export const EDITABLE_REVIEW_STATUSES: readonly string[] = [
  "DRAFT",
  "FLAGGED",
  "UNPUBLISHED",
];

// ============================================================
// Tulis opsi & sumber
// ============================================================

export async function replaceActivityOptions(
  db: Db,
  activityId: string,
  type: ActivityType,
  data: ActivityData,
): Promise<void> {
  await db.query(`DELETE FROM activity_option WHERE activity_id = $1::uuid`, [activityId]);
  const rows = deriveOptionRows(type, data);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    await db.query(
      `INSERT INTO activity_option (activity_id, position, payload, is_correct)
       VALUES ($1::uuid, $2, $3, $4)`,
      [activityId, i, JSON.stringify(row.payload), row.isCorrect],
    );
  }
}

export async function replaceActivitySources(
  db: Db,
  activityId: string,
  sources: SourceInput[],
): Promise<void> {
  await db.query(`DELETE FROM content_source WHERE activity_id = $1::uuid`, [activityId]);
  for (const source of sources) {
    await db.query(
      `INSERT INTO content_source (activity_id, title, source_type, reference_detail, methodology, is_disputed)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
      [
        activityId,
        source.title,
        source.sourceType,
        source.referenceDetail,
        source.methodology,
        source.isDisputed,
      ],
    );
  }
}

// ============================================================
// Query daftar & detail
// ============================================================

export interface ListOptions {
  areaCode?: string | null;
  status?: string | null;
  page: number;
  limit: number;
}

export interface ActivityListRow {
  id: string;
  prompt: string;
  interactionType: string;
  difficulty: number;
  targetAgeMin: number;
  targetAgeMax: number;
  reviewStatus: string;
  contentOrigin: string;
  areaCode: string;
  areaTitle: string;
  updatedAt: Date;
}

function buildWhere(options: ListOptions): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.areaCode) {
    params.push(options.areaCode);
    conditions.push(`a.learning_area_id = (SELECT id FROM learning_area WHERE code = $${params.length})`);
  }
  if (options.status && (REVIEW_STATUSES as readonly string[]).includes(options.status)) {
    params.push(options.status);
    conditions.push(`a.review_status = $${params.length}::content_review_status`);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export async function countReviewerActivities(
  db: Db,
  options: ListOptions,
): Promise<number> {
  const where = buildWhere(options);
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM activity a ${where.clause}`,
    where.params,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listReviewerActivities(
  db: Db,
  options: ListOptions,
): Promise<ActivityListRow[]> {
  const where = buildWhere(options);
  const offset = (options.page - 1) * options.limit;
  const dataParams = [...where.params, options.limit, offset];

  const rows = await db.query<{
    id: string;
    prompt: string;
    interaction_type: string;
    difficulty: number;
    target_age_min: number;
    target_age_max: number;
    review_status: string;
    content_origin: string;
    area_code: string;
    area_title: string;
    updated_at: Date;
  }>(
    `SELECT a.id, a.prompt, a.interaction_type, a.difficulty,
            a.target_age_min, a.target_age_max, a.review_status,
            a.content_origin, la.code AS area_code, la.title AS area_title,
            a.updated_at
       FROM activity a
       JOIN learning_area la ON la.id = a.learning_area_id
       ${where.clause}
       ORDER BY a.updated_at DESC, a.id ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams,
  );

  return rows.rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    interactionType: r.interaction_type,
    difficulty: r.difficulty,
    targetAgeMin: r.target_age_min,
    targetAgeMax: r.target_age_max,
    reviewStatus: r.review_status,
    contentOrigin: r.content_origin,
    areaCode: r.area_code,
    areaTitle: r.area_title,
    updatedAt: r.updated_at,
  }));
}

export interface ActivityDetail extends ActivityListRow {
  skillId: string;
  learningAreaId: string;
  correctAnswer: unknown;
  explanation: string | null;
  version: number;
  createdAt: Date;
}

export interface ActivityOptionRow {
  id: string;
  position: number;
  payload: Record<string, unknown>;
  isCorrect: boolean;
}

export interface ActivitySourceRow {
  id: string;
  title: string;
  sourceType: string;
  referenceDetail: string;
  methodology: string | null;
  isDisputed: boolean;
}

export async function getReviewerActivityDetail(
  db: Db,
  activityId: string,
): Promise<{ activity: ActivityDetail; options: ActivityOptionRow[]; sources: ActivitySourceRow[] } | null> {
  const rows = await db.query<{
    id: string;
    skill_id: string;
    learning_area_id: string;
    target_age_min: number;
    target_age_max: number;
    difficulty: number;
    prompt: string;
    interaction_type: string;
    correct_answer: unknown;
    explanation: string | null;
    content_origin: string;
    review_status: string;
    version: number;
    created_at: Date;
    updated_at: Date;
    area_code: string;
    area_title: string;
  }>(
    `SELECT a.id, a.skill_id, a.learning_area_id, a.target_age_min, a.target_age_max,
            a.difficulty, a.prompt, a.interaction_type, a.correct_answer, a.explanation,
            a.content_origin, a.review_status, a.version, a.created_at, a.updated_at,
            la.code AS area_code, la.title AS area_title
       FROM activity a
       JOIN learning_area la ON la.id = a.learning_area_id
      WHERE a.id = $1::uuid`,
    [activityId],
  );

  const row = rows.rows[0];
  if (!row) return null;

  const optionRows = await db.query<{
    id: string;
    position: number;
    payload: Record<string, unknown> | null;
    is_correct: boolean;
  }>(
    `SELECT id, position, payload, is_correct
       FROM activity_option
      WHERE activity_id = $1::uuid
      ORDER BY position ASC`,
    [activityId],
  );

  const sourceRows = await db.query<{
    id: string;
    title: string;
    source_type: string;
    reference_detail: string;
    methodology: string | null;
    is_disputed: boolean;
  }>(
    `SELECT id, title, source_type, reference_detail, methodology, is_disputed
       FROM content_source
      WHERE activity_id = $1::uuid
      ORDER BY created_at ASC, id ASC`,
    [activityId],
  );

  return {
    activity: {
      id: row.id,
      skillId: row.skill_id,
      learningAreaId: row.learning_area_id,
      targetAgeMin: row.target_age_min,
      targetAgeMax: row.target_age_max,
      difficulty: row.difficulty,
      prompt: row.prompt,
      interactionType: row.interaction_type,
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      contentOrigin: row.content_origin,
      reviewStatus: row.review_status,
      version: row.version,
      areaCode: row.area_code,
      areaTitle: row.area_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    options: optionRows.rows.map((o) => ({
      id: o.id,
      position: o.position,
      payload: o.payload && typeof o.payload === "object" ? o.payload : {},
      isCorrect: o.is_correct === true,
    })),
    sources: sourceRows.rows.map((s) => ({
      id: s.id,
      title: s.title,
      sourceType: s.source_type,
      referenceDetail: s.reference_detail,
      methodology: s.methodology,
      isDisputed: s.is_disputed === true,
    })),
  };
}
