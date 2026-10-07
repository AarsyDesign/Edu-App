/**
 * Payload editor aktivitas (VRD 11.2–11.10) — logika murni tanpa DOM.
 *
 * Dipanggil dari skrip `ActivityEditorForm.astro` (baris dibaca dari DOM lalu
 * diserahkan sebagai data polos) supaya penyusunan payload & pemeriksaan
 * sebelum kirim bisa diuji langsung di Node tanpa browser.
 *
 * Server tetap sumber kebenaran: `parseEditorPayload` (lib/reviewer.ts)
 * memvalidasi ulang seluruh payload; fungsi di sini hanya memotong jalan
 * galat yang jelas sebelum permintaan dikirim.
 */
import type { ActivityType } from "./domain.ts";

/** Satu baris opsi dari DOM, kunci = `data-f` pada input. */
export interface EditorRowData {
  [key: string]: string | boolean;
}

export interface EditorCommonInput {
  prompt: string;
  interactionType: ActivityType;
  learningAreaId: string;
  skillId: string;
  targetAgeMin: number;
  targetAgeMax: number;
  difficulty: number;
  explanation: string | null;
  contentOrigin: string;
  sources: Array<Record<string, unknown>>;
}

export interface BuildInput {
  common: EditorCommonInput;
  /** Baris panel tipe yang sedang aktif. */
  rows: EditorRowData[];
  /** Hanya untuk TRUE_FALSE; `null` bila belum dipilih. */
  trueFalse: boolean | null;
}

function str(row: EditorRowData, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function bool(row: EditorRowData, key: string): boolean {
  return row[key] === true;
}

function num(row: EditorRowData, key: string): number {
  const value = Number(str(row, key));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Susun `correct_answer` untuk tipe yang dipilih. Mengembalikan objek siap
 * kirim berikut field biasa (prompt, area, usia, dst.).
 */
export function buildActivityPayload(input: BuildInput): Record<string, unknown> {
  const { common, rows, trueFalse } = input;
  const type = common.interactionType;

  const withAnswer = (correctAnswer: Record<string, unknown>): Record<string, unknown> => ({
    prompt: common.prompt,
    interaction_type: type,
    learning_area_id: common.learningAreaId,
    skill_id: common.skillId,
    target_age_min: common.targetAgeMin,
    target_age_max: common.targetAgeMax,
    difficulty: common.difficulty,
    explanation: common.explanation,
    content_origin: common.contentOrigin,
    sources: common.sources,
    correct_answer: correctAnswer,
  });

  switch (type) {
    case "TAP_ANSWER":
      return withAnswer({
        type: "tap_answer",
        items: rows.map((row, index) => {
          const value = str(row, "value");
          return {
            id: `opt-${index + 1}`,
            label: str(row, "label"),
            ...(value ? { value } : {}),
            isCorrect: bool(row, "correct"),
          };
        }),
      });

    case "MULTIPLE_CHOICE":
      return withAnswer({
        type: "multiple_choice",
        question: common.prompt,
        options: rows.map((row, index) => ({
          id: `opt-${index + 1}`,
          label: str(row, "label"),
          isCorrect: bool(row, "correct"),
        })),
      });

    case "TRUE_FALSE":
      // `null` = belum dipilih → sengaja tidak ditebak; `validateActivityPayload`
      // menolaknya dengan pesan yang jelas sebelum permintaan dikirim.
      return withAnswer({
        type: "true_false",
        statement: common.prompt,
        correctAnswer: trueFalse === null ? null : trueFalse,
      });

    case "COUNT_OBJECTS": {
      const objects = rows.map((row, index) => ({
        id: `obj-${index + 1}`,
        visualKey: str(row, "visualKey"),
        count: Math.max(0, Math.floor(num(row, "count"))),
      }));
      const total = objects.reduce((sum, obj) => sum + obj.count, 0);
      return withAnswer({
        type: "count_objects",
        objects,
        correctAnswer: total,
        maxAnswer: total,
      });
    }

    case "SEQUENCE":
      return withAnswer({
        type: "sequence",
        items: rows.map((row, index) => ({
          id: `seq-${index + 1}`,
          label: str(row, "label"),
          correctPosition: index,
        })),
      });

    case "MATCH": {
      const left = rows.map((row, index) => ({
        id: `left-${index + 1}`,
        label: str(row, "left"),
      }));
      const right = rows.map((row, index) => ({
        id: `right-${index + 1}`,
        label: str(row, "right"),
      }));
      const correctPairs: Record<string, string> = {};
      rows.forEach((_, index) => {
        correctPairs[`left-${index + 1}`] = `right-${index + 1}`;
      });
      return withAnswer({ type: "match", left, right, correctPairs });
    }

    case "IDENTIFY_COLOR": {
      const options = rows.map((row, index) => ({
        id: `opt-${index + 1}`,
        colorName: str(row, "colorName"),
        colorValue: str(row, "colorValue") || "#000000",
        isCorrect: bool(row, "correct"),
      }));
      const correct = options.find((option) => option.isCorrect);
      return withAnswer({
        type: "identify_color",
        targetColorName: correct?.colorName ?? "",
        options,
      });
    }

    case "IDENTIFY_SHAPE": {
      const options = rows.map((row, index) => ({
        id: `opt-${index + 1}`,
        shapeName: str(row, "shapeName"),
        shapeKey: str(row, "shapeKey") || "circle",
        isCorrect: bool(row, "correct"),
      }));
      const correct = options.find((option) => option.isCorrect);
      return withAnswer({
        type: "identify_shape",
        targetShapeName: correct?.shapeName ?? "",
        options,
      });
    }

    default:
      throw new Error("Tipe interaksi tidak dikenal.");
  }
}

/**
 * Pemeriksaan cepat sebelum kirim. Mengembalikan pesan galat berbahasa
 * Indonesia, atau `null` bila payload masuk akal untuk dikirim ke server.
 */
export function validateActivityPayload(payload: Record<string, unknown>): string | null {
  const type = String(payload.interaction_type ?? "");
  const answer = payload.correct_answer as Record<string, unknown> | undefined;

  if (!payload.prompt) return "Pertanyaan wajib diisi.";
  if (Number(payload.target_age_min) > Number(payload.target_age_max)) {
    return "Usia terkecil tidak boleh melebihi usia terbesar.";
  }
  if (!payload.skill_id) return "Area belajar ini belum punya skill.";

  if (type === "TRUE_FALSE") {
    if (!answer || typeof answer.correctAnswer !== "boolean") {
      return "Pilih salah satu: pernyataan benar atau salah.";
    }
    return null;
  }

  const list = (answer?.items ??
    answer?.options ??
    answer?.objects ??
    answer?.left) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(list) || list.length === 0) return "Lengkapi opsi jawaban.";

  const labels = list.map((item) =>
    String(item.label ?? item.colorName ?? item.shapeName ?? item.visualKey ?? "").trim(),
  );
  if (labels.some((label) => !label)) return "Setiap baris wajib diisi.";

  if (type === "TAP_ANSWER" || type === "IDENTIFY_COLOR" || type === "IDENTIFY_SHAPE") {
    const correct = list.filter((item) => item.isCorrect === true).length;
    if (correct !== 1) return "Tandai tepat satu opsi sebagai benar.";
    if (new Set(labels).size !== labels.length) return "Teks pilihan tidak boleh sama persis.";
    return null;
  }

  if (type === "MULTIPLE_CHOICE") {
    if (list.length < 2) return "Pilihan ganda butuh minimal dua opsi.";
    if (!list.some((item) => item.isCorrect === true)) return "Tandai minimal satu opsi benar.";
    if (new Set(labels).size !== labels.length) return "Teks pilihan tidak boleh sama persis.";
    return null;
  }

  if (type === "COUNT_OBJECTS") {
    if (list.some((item) => !Number.isFinite(Number(item.count)) || Number(item.count) <= 0)) {
      return "Jumlah tiap kelompok harus lebih dari nol.";
    }
    return null;
  }

  if (type === "SEQUENCE") {
    if (list.length < 2) return "Butuh minimal dua baris.";
    if (new Set(labels).size !== labels.length) return "Teks langkah tidak boleh sama persis.";
    return null;
  }

  if (type === "MATCH") {
    if (list.length < 2) return "Butuh minimal dua pasangan.";
    const rights = ((answer?.right ?? []) as Array<Record<string, unknown>>).map((item) =>
      String(item.label ?? "").trim(),
    );
    if (rights.length !== list.length || rights.some((label) => !label)) {
      return "Setiap pasangan butuh sisi kiri dan kanan.";
    }
    return null;
  }

  return null;
}
