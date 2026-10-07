/**
 * Skema & validasi batch draf aktivitas untuk pipeline AI (VRD 12.1, 12.3–12.6).
 *
 * Alur PRD §5: `AI draft -> human review -> correction -> QA -> publish`, dan
 * PRD §19: AI content generation **di luar jalur runtime anak** — modul ini
 * tidak pernah dipanggil dari rute `/learn` atau endpoint anak; satu-satunya
 * pintu masuk adalah endpoint reviewer `POST /api/reviewer/aktivitas/import`.
 *
 * Yang dipegang modul ini (murni, tanpa DB/DOM supaya bisa diuji di Node):
 *
 * 1. **12.1 skema terstruktur** — `parseDraftBatch` menerima amplop
 *    `{ schema_version, model?, prompt_version?, drafts: [...] }` sesuai
 *    `docs/AI-DRAFT-SCHEMA.md` (di sana juga ada templat prompt).
 * 2. **12.3 validasi skema / 12.4 draf rusak ditolak** — satu batch divalidasi
 *    utuh; draf yang gagal membuat **seluruh batch** ditolak dengan pesan yang
 *    menunjuk nomor drafnya (`Draf ke-N: ...`), jadi tidak ada batch parsial.
 * 3. **12.5 penandaan `AI_DRAFT`** — `toEditorBody` MEMAKSA
 *    `content_origin: "AI_DRAFT"`; klaim asal apa pun dari draf diabaikan,
 *    sehingga konten AI tidak bisa menyamar sebagai buatan manusia.
 * 4. **12.6 masuk antrean review** — batch disimpan sebagai `DRAFT` oleh
 *    endpoint (lihat `src/pages/api/reviewer/aktivitas/import.ts`); reviewer
 *    lalu menjalankan transisi status normal (VRD 11.11).
 *
 * Pembangkit/penyedia model (VRD 12.2) menunggu keputusan OQ 26 — modul ini
 * sengaja tidak mengasumsikan API apa pun.
 */
import { validateActivityData, type ActivityData, type ActivityType } from "./domain.ts";
import { ACTIVITY_TYPES, type SourceInput } from "./reviewer.ts";

// ============================================================
// Konstanta skema
// ============================================================

/** Versi skema batch draf. Naikkan hanya bila bentuk draf berubah. */
export const AI_DRAFT_SCHEMA_VERSION = 1;

/** Batas draf per batch (12.2: "generate small batches"). */
export const DRAFT_BATCH_MAX = 25;

/** Batas yang sama dengan editor (VRD 11.2–11.10). */
const PROMPT_MAX = 500;
const EXPLANATION_MAX = 1000;
const SOURCES_MAX = 5;
const CODE_RE = /^[a-z0-9_]{1,60}$/;
const PROVENANCE_MAX = 120;

// ============================================================
// Tipe hasil
// ============================================================

export interface ParsedDraft {
  areaCode: string;
  skillCode: string | null;
  prompt: string;
  interactionType: ActivityType;
  targetAgeMin: number;
  targetAgeMax: number;
  difficulty: number;
  correctAnswer: ActivityData;
  explanation: string | null;
  sources: SourceInput[];
}

export interface ParsedDraftBatch {
  schemaVersion: number;
  model: string | null;
  promptVersion: string | null;
  drafts: ParsedDraft[];
}

export type DraftBatchResult =
  | { ok: true; batch: ParsedDraftBatch }
  | { ok: false; message: string };

function fail(message: string, draftIndex?: number): DraftBatchResult {
  return {
    ok: false,
    message: draftIndex === undefined ? message : `Draf ke-${draftIndex + 1}: ${message}`,
  };
}

/**
 * Teks provenance opsional (`model`, `prompt_version`): diabaikan bila tidak
 * diisi, tetapi bila diisi wajib berupa teks dalam batas — generator yang
 * mengirim angka/path tetap ditolak dengan pesan jelas.
 */
function parseProvenance(
  value: unknown,
  field: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: `${field} harus berupa teks.` };
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > PROVENANCE_MAX) {
    return { ok: false, message: `${field} maksimal ${PROVENANCE_MAX} karakter.` };
  }
  return { ok: true, value: trimmed };
}

function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

// ============================================================
// 12.1 + 12.3 — parsing & validasi batch
// ============================================================

/**
 * Validasi satu draf. Pesan galat sudah tanpa prefiks; pemanggil (batch)
 * menambahkan nomor draf.
 */
function parseDraft(raw: unknown): { ok: true; draft: ParsedDraft } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Setiap draf harus berupa objek." };
  }
  const body = raw as Record<string, unknown>;

  const areaCode = typeof body.area_code === "string" ? body.area_code.trim() : "";
  if (!CODE_RE.test(areaCode)) {
    return { ok: false, message: "area_code wajib diisi (huruf kecil, angka, garis bawah)." };
  }

  let skillCode: string | null = null;
  if (body.skill_code !== undefined && body.skill_code !== null && body.skill_code !== "") {
    if (typeof body.skill_code !== "string" || !CODE_RE.test(body.skill_code.trim())) {
      return { ok: false, message: "skill_code tidak valid." };
    }
    skillCode = body.skill_code.trim();
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return { ok: false, message: "prompt wajib diisi." };
  if (prompt.length > PROMPT_MAX) {
    return { ok: false, message: `prompt maksimal ${PROMPT_MAX} karakter.` };
  }

  const typeRaw = typeof body.interaction_type === "string" ? body.interaction_type.toUpperCase() : "";
  if (!(ACTIVITY_TYPES as readonly string[]).includes(typeRaw)) {
    return { ok: false, message: "interaction_type tidak dikenal." };
  }
  const interactionType = typeRaw as ActivityType;

  const targetAgeMin = intInRange(body.target_age_min, 3, 7);
  if (targetAgeMin === null) return { ok: false, message: "target_age_min harus bilangan bulat 3–7." };
  const targetAgeMax = intInRange(body.target_age_max, 3, 7);
  if (targetAgeMax === null) return { ok: false, message: "target_age_max harus bilangan bulat 3–7." };
  if (targetAgeMin > targetAgeMax) {
    return { ok: false, message: "target_age_min tidak boleh melebihi target_age_max." };
  }

  const difficulty = intInRange(body.difficulty, 1, 3);
  if (difficulty === null) return { ok: false, message: "difficulty harus 1–3." };

  const rawAnswer = body.correct_answer;
  if (!rawAnswer || typeof rawAnswer !== "object" || Array.isArray(rawAnswer)) {
    return { ok: false, message: "correct_answer wajib berupa objek sesuai tipe interaksi." };
  }
  let correctAnswer: ActivityData;
  try {
    correctAnswer = validateActivityData(interactionType, rawAnswer);
  } catch (error) {
    return { ok: false, message: `correct_answer tidak valid: ${(error as Error).message}` };
  }

  let explanation: string | null = null;
  if (body.explanation !== undefined && body.explanation !== null && body.explanation !== "") {
    if (typeof body.explanation !== "string") {
      return { ok: false, message: "explanation harus berupa teks." };
    }
    explanation = body.explanation.trim();
    if (explanation === "") explanation = null;
    else if (explanation.length > EXPLANATION_MAX) {
      return { ok: false, message: `explanation maksimal ${EXPLANATION_MAX} karakter.` };
    }
  }

  // Sumber: aturan identik dengan parseEditorPayload (VRD 11.9) — server
  // memvalidasi ulang lewat parseEditorPayload, jadi ini lapis pertama yang
  // memberi pesan bernomor draf.
  const sources: SourceInput[] = [];
  if (body.sources !== undefined && body.sources !== null) {
    if (!Array.isArray(body.sources)) return { ok: false, message: "sources harus berupa daftar." };
    if (body.sources.length > SOURCES_MAX) {
      return { ok: false, message: `Maksimal ${SOURCES_MAX} sumber per draf.` };
    }
    for (const rawSource of body.sources) {
      if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
        return { ok: false, message: "Ada sumber yang tidak valid." };
      }
      const item = rawSource as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const sourceType = typeof item.source_type === "string" ? item.source_type.trim() : "";
      const referenceDetail =
        typeof item.reference_detail === "string" ? item.reference_detail.trim() : "";
      if (!title || title.length > 300) {
        return { ok: false, message: "Judul sumber wajib diisi (maks 300 karakter)." };
      }
      if (!sourceType || sourceType.length > 60) {
        return { ok: false, message: "Jenis sumber wajib diisi (maks 60 karakter)." };
      }
      if (!referenceDetail || referenceDetail.length > 2000) {
        return { ok: false, message: "Rujukan sumber wajib diisi (maks 2000 karakter)." };
      }
      let methodology: string | null = null;
      if (typeof item.methodology === "string" && item.methodology.trim() !== "") {
        methodology = item.methodology.trim();
        if (methodology.length > 2000) {
          return { ok: false, message: "Metode peninjauan maksimal 2000 karakter." };
        }
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
    draft: {
      areaCode,
      skillCode,
      prompt,
      interactionType,
      targetAgeMin,
      targetAgeMax,
      difficulty,
      correctAnswer,
      explanation,
      sources,
    },
  };
}

/**
 * Validasi amplop batch. Semua draf harus lolos — bila satu gagal, batch
 * utuh ditolak (VRD 12.4) sehingga reviewer tidak menerima batch setengah
 * jadi.
 */
export function parseDraftBatch(raw: unknown): DraftBatchResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("Batch draf harus berupa objek JSON.");
  }
  const body = raw as Record<string, unknown>;

  if (body.schema_version !== AI_DRAFT_SCHEMA_VERSION) {
    return fail(`schema_version harus ${AI_DRAFT_SCHEMA_VERSION}.`);
  }

  const drafts = body.drafts;
  if (!Array.isArray(drafts)) return fail("drafts harus berupa daftar.");
  if (drafts.length === 0) return fail("Batch tidak berisi draf apa pun.");
  if (drafts.length > DRAFT_BATCH_MAX) {
    return fail(`Satu batch maksimal ${DRAFT_BATCH_MAX} draf.`);
  }

  const modelField = parseProvenance(body.model, "model");
  if (!modelField.ok) return fail(modelField.message);
  const promptVersionField = parseProvenance(body.prompt_version, "prompt_version");
  if (!promptVersionField.ok) return fail(promptVersionField.message);

  const parsed: ParsedDraft[] = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const result = parseDraft(drafts[i]);
    if (!result.ok) return fail(result.message, i);
    parsed.push(result.draft);
  }

  return {
    ok: true,
    batch: {
      schemaVersion: AI_DRAFT_SCHEMA_VERSION,
      model: modelField.value,
      promptVersion: promptVersionField.value,
      drafts: parsed,
    },
  };
}

// ============================================================
// 12.5 — penandaan asal konten
// ============================================================

/**
 * Petakan draf tervalidasi ke bentuk body editor sehingga server cukup
 * memanggil `parseEditorPayload` (satu pintu validasi, VRD 11.2) lalu
 * menyimpannya.
 *
 * `content_origin` SELALU `AI_DRAFT` (VRD 12.5): field `content_origin` dari
 * draf tidak pernah dibaca, jadi tidak ada jalur menyamar sebagai
 * `HUMAN_CREATED` lewat impor.
 */
export function toEditorBody(
  draft: ParsedDraft,
  ids: { learningAreaId: string; skillId: string | null },
): Record<string, unknown> {
  return {
    prompt: draft.prompt,
    interaction_type: draft.interactionType,
    learning_area_id: ids.learningAreaId,
    skill_id: ids.skillId,
    target_age_min: draft.targetAgeMin,
    target_age_max: draft.targetAgeMax,
    difficulty: draft.difficulty,
    correct_answer: draft.correctAnswer,
    explanation: draft.explanation,
    content_origin: "AI_DRAFT",
    sources: draft.sources.map((source) => ({
      title: source.title,
      source_type: source.sourceType,
      reference_detail: source.referenceDetail,
      methodology: source.methodology,
      is_disputed: source.isDisputed,
    })),
  };
}
