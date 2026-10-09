/**
 * Activity Domain Contract — VRD Phase 6.1
 *
 * Kontrak data untuk semua tipe aktivitas MVP.
 * Renderer & validasi server-side HARUS mengikuti kontrak ini.
 * Tidak ada logika UI di sini — hanya tipe data & guard.
 */

// ============================================================
// Base shapes (digunakan di activity.option.payload & correct_answer)
// ============================================================

/** Tap Answer: child taps the correct item */
export interface TapAnswerData {
  type: "tap_answer";
  /** Array of selectable items; exactly one has isCorrect: true */
  items: Array<{
    id: string;
    /** Visual label (text, emoji, or SVG key) */
    label: string;
    /** Optional visual hint (e.g., "apple", "3") */
    value?: string;
    /** Exactly one item must have this true */
    isCorrect: boolean;
  }>;
}

/** Count Objects: child counts objects and inputs number */
export interface CountObjectsData {
  type: "count_objects";
  /** Array of object groups to count */
  objects: Array<{
    id: string;
    /** Visual representation key */
    visualKey: string;
    /** How many of this object */
    count: number;
  }>;
  /** Correct total count */
  correctAnswer: number;
  /** Maximum allowed answer (for input validation) */
  maxAnswer?: number;
}

/** Match: child drags/connects items from left to right */
export interface MatchData {
  type: "match";
  /** Left side items */
  left: Array<{
    id: string;
    label: string;
    visualKey?: string;
  }>;
  /** Right side items */
  right: Array<{
    id: string;
    label: string;
    visualKey?: string;
  }>;
  /** Correct pairs: leftId -> rightId */
  correctPairs: Record<string, string>;
}

/** Sequence: child arranges items in correct order */
export interface SequenceData {
  type: "sequence";
  /** Items to sequence (shuffled for presentation) */
  items: Array<{
    id: string;
    label: string;
    visualKey?: string;
    /** Correct position (0-indexed) */
    correctPosition: number;
  }>;
}

/** Identify Color: child selects the named color */
export interface IdentifyColorData {
  type: "identify_color";
  /** Target color name (e.g., "merah", "blue") */
  targetColorName: string;
  /** Color options to choose from */
  options: Array<{
    id: string;
    /** CSS color value for display */
    colorValue: string;
    /** Color name */
    colorName: string;
    isCorrect: boolean;
  }>;
}

/** Identify Shape: child selects the named shape */
export interface IdentifyShapeData {
  type: "identify_shape";
  /** Target shape name (e.g., "lingkaran", "circle") */
  targetShapeName: string;
  /** Shape options to choose from */
  options: Array<{
    id: string;
    /** Shape key for visual rendering */
    shapeKey: string;
    /** Shape name */
    shapeName: string;
    isCorrect: boolean;
  }>;
}

/** Multiple Choice: child selects one correct option */
export interface MultipleChoiceData {
  type: "multiple_choice";
  /** Question prompt (short) */
  question: string;
  /** Answer options */
  options: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
  }>;
  /** Allow multiple correct answers */
  allowMultiple?: false;
}

/** True/False: child selects true or false */
export interface TrueFalseData {
  type: "true_false";
  /** Statement to evaluate */
  statement: string;
  /** Correct answer */
  correctAnswer: boolean;
  /** True label (default "Benar") */
  trueLabel?: string;
  /** False label (default "Salah") */
  falseLabel?: string;
}

/** Union of all activity data types */
export type ActivityData =
  | TapAnswerData
  | CountObjectsData
  | MatchData
  | SequenceData
  | IdentifyColorData
  | IdentifyShapeData
  | MultipleChoiceData
  | TrueFalseData;

/** ActivityType enum (mirrors db/migrations/0001_init.sql activity_type enum) */
export type ActivityType =
  | "TAP_ANSWER"
  | "COUNT_OBJECTS"
  | "MATCH"
  | "SEQUENCE"
  | "IDENTIFY_COLOR"
  | "IDENTIFY_SHAPE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE";

/** Map ActivityType enum to ActivityData type */
export type ActivityDataForType<T extends ActivityType> =
  T extends "TAP_ANSWER" ? TapAnswerData :
  T extends "COUNT_OBJECTS" ? CountObjectsData :
  T extends "MATCH" ? MatchData :
  T extends "SEQUENCE" ? SequenceData :
  T extends "IDENTIFY_COLOR" ? IdentifyColorData :
  T extends "IDENTIFY_SHAPE" ? IdentifyShapeData :
  T extends "MULTIPLE_CHOICE" ? MultipleChoiceData :
  T extends "TRUE_FALSE" ? TrueFalseData :
  never;

// ============================================================
// Activity Option (maps to activity_option table payload)
// ============================================================

export interface ActivityOption {
  id: string;
  position: number;
  payload: TapAnswerData["items"][0] | CountObjectsData["objects"][0] | MatchData["left"][0] | SequenceData["items"][0] | IdentifyColorData["options"][0] | IdentifyShapeData["options"][0] | MultipleChoiceData["options"][0] | { label: string; value?: boolean };
  isCorrect: boolean;
}

// ============================================================
// Validation Result
// ============================================================

export interface ValidationResult {
  isCorrect: boolean;
  /** Explanation for child (shown after attempt) */
  explanation?: string;
  /** Optional hint for retry */
  hint?: string;
}

// ============================================================
// Type Guards (untuk narrow ActivityData)
// ============================================================

export function isTapAnswerData(data: ActivityData): data is TapAnswerData {
  return data.type === "tap_answer";
}

export function isCountObjectsData(data: ActivityData): data is CountObjectsData {
  return data.type === "count_objects";
}

export function isMatchData(data: ActivityData): data is MatchData {
  return data.type === "match";
}

export function isSequenceData(data: ActivityData): data is SequenceData {
  return data.type === "sequence";
}

export function isIdentifyColorData(data: ActivityData): data is IdentifyColorData {
  return data.type === "identify_color";
}

export function isIdentifyShapeData(data: ActivityData): data is IdentifyShapeData {
  return data.type === "identify_shape";
}

export function isMultipleChoiceData(data: ActivityData): data is MultipleChoiceData {
  return data.type === "multiple_choice";
}

export function isTrueFalseData(data: ActivityData): data is TrueFalseData {
  return data.type === "true_false";
}

// ============================================================
// Schema Validation (runtime, untuk server-side)
// ============================================================

/** Pola kunci visual konten — dipakai sebagai kelas CSS, jadi sama ketatnya
 * dengan `avatarKey` profil anak (hanya [a-z0-9_-], maks 40). */
export const VISUAL_KEY_RE = /^[a-z0-9_-]{1,40}$/;

/** Pagar payload COUNT_OBJECTS per kelompok: perender menggambar `count`
 * titik, jadi angka liar tidak boleh sampai ke layar anak. Bukan batas
 * produk — hanya limit teknis render. */
export const COUNT_MAX_PER_GROUP = 100;

/** Validasi payload aktivitas sesuai tipe */
export function validateActivityData(type: ActivityType, payload: unknown): ActivityData {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid activity payload: not an object`);
  }

  const data = payload as Record<string, unknown>;

  // Common: type must match
  if (data.type !== type.toLowerCase().replace("_", "_")) {
    // Allow both SNAKE_CASE and lower_snake_case
    const expected = type.toLowerCase();
    const actual = String(data.type).toLowerCase();
    if (actual !== expected) {
      throw new Error(`Activity type mismatch: expected ${expected}, got ${actual}`);
    }
  }

  switch (type) {
    case "TAP_ANSWER": {
      const d = data as unknown as TapAnswerData;
      if (!Array.isArray(d.items) || d.items.length < 2) {
        throw new Error("TAP_ANSWER: items array required (min 2)");
      }
      const correctCount = d.items.filter((i) => i.isCorrect === true).length;
      if (correctCount !== 1) {
        throw new Error("TAP_ANSWER: exactly one item must have isCorrect=true");
      }
      for (const item of d.items) {
        if (!item.id || !item.label || typeof item.isCorrect !== "boolean") {
          throw new Error("TAP_ANSWER: each item needs id, label, isCorrect");
        }
      }
      return d;
    }

    case "COUNT_OBJECTS": {
      const d = data as unknown as CountObjectsData;
      if (!Array.isArray(d.objects) || d.objects.length === 0) {
        throw new Error("COUNT_OBJECTS: objects array required");
      }
      if (typeof d.correctAnswer !== "number" || d.correctAnswer < 0) {
        throw new Error("COUNT_OBJECTS: correctAnswer must be non-negative number");
      }
      for (const obj of d.objects) {
        if (!obj.id || typeof obj.count !== "number" || obj.count < 0) {
          throw new Error("COUNT_OBJECTS: each object needs id, visualKey, count>=0");
        }
        // Kunci visual dipakai sebagai nama kelas CSS di perender — pola yang
        // sama dengan kunci lain di aplikasi (avatarKey), supaya konten tidak
        // pernah menuliskan markup bebas ke layar anak.
        if (!VISUAL_KEY_RE.test(obj.visualKey ?? "")) {
          throw new Error(
            "COUNT_OBJECTS: visualKey must match ^[a-z0-9_-]{1,40}$",
          );
        }
        // Batas payload: jumlah yang bisa dirender (perender menggambar
        // `count` titik per kelompok). Bukan batas produk — hanya pagar
        // supaya payload rusak tidak membuat layar anak macet.
        if (!Number.isInteger(obj.count) || obj.count > COUNT_MAX_PER_GROUP) {
          throw new Error(
            `COUNT_OBJECTS: count must be an integer 0..${COUNT_MAX_PER_GROUP}`,
          );
        }
      }
      return d;
    }

    case "MATCH": {
      const d = data as unknown as MatchData;
      if (!Array.isArray(d.left) || d.left.length === 0) {
        throw new Error("MATCH: left array required");
      }
      if (!Array.isArray(d.right) || d.right.length === 0) {
        throw new Error("MATCH: right array required");
      }
      if (!d.correctPairs || typeof d.correctPairs !== "object") {
        throw new Error("MATCH: correctPairs object required");
      }
      const leftIds = new Set(d.left.map((l) => l.id));
      const rightIds = new Set(d.right.map((r) => r.id));
      for (const [leftId, rightId] of Object.entries(d.correctPairs)) {
        if (!leftIds.has(leftId)) throw new Error(`MATCH: unknown leftId ${leftId}`);
        if (!rightIds.has(rightId)) throw new Error(`MATCH: unknown rightId ${rightId}`);
      }
      return d;
    }

    case "SEQUENCE": {
      const d = data as unknown as SequenceData;
      if (!Array.isArray(d.items) || d.items.length < 2) {
        throw new Error("SEQUENCE: items array required (min 2)");
      }
      const positions = d.items.map((i) => i.correctPosition).sort((a, b) => a - b);
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] !== i) {
          throw new Error("SEQUENCE: correctPosition must be 0..n-1 without gaps");
        }
      }
      for (const item of d.items) {
        if (!item.id || !item.label || typeof item.correctPosition !== "number") {
          throw new Error("SEQUENCE: each item needs id, label, correctPosition");
        }
      }
      return d;
    }

    case "IDENTIFY_COLOR": {
      const d = data as unknown as IdentifyColorData;
      if (!d.targetColorName || typeof d.targetColorName !== "string") {
        throw new Error("IDENTIFY_COLOR: targetColorName required");
      }
      if (!Array.isArray(d.options) || d.options.length < 2) {
        throw new Error("IDENTIFY_COLOR: options array required (min 2)");
      }
      const correctCount = d.options.filter((o) => o.isCorrect === true).length;
      if (correctCount !== 1) {
        throw new Error("IDENTIFY_COLOR: exactly one option must have isCorrect=true");
      }
      for (const opt of d.options) {
        if (!opt.id || !opt.colorValue || !opt.colorName || typeof opt.isCorrect !== "boolean") {
          throw new Error("IDENTIFY_COLOR: each option needs id, colorValue, colorName, isCorrect");
        }
      }
      return d;
    }

    case "IDENTIFY_SHAPE": {
      const d = data as unknown as IdentifyShapeData;
      if (!d.targetShapeName || typeof d.targetShapeName !== "string") {
        throw new Error("IDENTIFY_SHAPE: targetShapeName required");
      }
      if (!Array.isArray(d.options) || d.options.length < 2) {
        throw new Error("IDENTIFY_SHAPE: options array required (min 2)");
      }
      const correctCount = d.options.filter((o) => o.isCorrect === true).length;
      if (correctCount !== 1) {
        throw new Error("IDENTIFY_SHAPE: exactly one option must have isCorrect=true");
      }
      for (const opt of d.options) {
        if (!opt.id || !opt.shapeKey || !opt.shapeName || typeof opt.isCorrect !== "boolean") {
          throw new Error("IDENTIFY_SHAPE: each option needs id, shapeKey, shapeName, isCorrect");
        }
      }
      return d;
    }

    case "MULTIPLE_CHOICE": {
      const d = data as unknown as MultipleChoiceData;
      if (!d.question || typeof d.question !== "string") {
        throw new Error("MULTIPLE_CHOICE: question required");
      }
      if (!Array.isArray(d.options) || d.options.length < 2) {
        throw new Error("MULTIPLE_CHOICE: options array required (min 2)");
      }
      const correctCount = d.options.filter((o) => o.isCorrect === true).length;
      if (correctCount === 0) {
        throw new Error("MULTIPLE_CHOICE: at least one option must have isCorrect=true");
      }
      for (const opt of d.options) {
        if (!opt.id || !opt.label || typeof opt.isCorrect !== "boolean") {
          throw new Error("MULTIPLE_CHOICE: each option needs id, label, isCorrect");
        }
      }
      return d;
    }

    case "TRUE_FALSE": {
      const d = data as unknown as TrueFalseData;
      if (!d.statement || typeof d.statement !== "string") {
        throw new Error("TRUE_FALSE: statement required");
      }
      if (typeof d.correctAnswer !== "boolean") {
        throw new Error("TRUE_FALSE: correctAnswer must be boolean");
      }
      return d;
    }

    default:
      throw new Error(`Unknown activity type: ${type}`);
  }
}

// ============================================================
// Answer Validation (server-side, VRD 6.9)
// ============================================================

/** Validasi jawaban anak untuk semua tipe aktivitas */
export function validateAnswer(
  activityType: ActivityType,
  activityData: ActivityData,
  childAnswer: unknown,
): ValidationResult {
  switch (activityType) {
    case "TAP_ANSWER": {
      const data = activityData as unknown as TapAnswerData;
      const answer = childAnswer as { id?: string } | string | undefined;
      const answerId = typeof answer === "string" ? answer : String(answer?.id ?? "");
      const correctItem = data.items.find((i) => i.isCorrect);
      const isCorrect = correctItem?.id === answerId;
      return {
        isCorrect,
        explanation: isCorrect
          ? "Tepat sekali!"
          : "Belum tepat, coba lagi.",
        hint: isCorrect ? undefined : `Cari yang ${correctItem?.label ?? "benar"}`,
      };
    }

    case "COUNT_OBJECTS": {
      const data = activityData as unknown as CountObjectsData;
      const answer = childAnswer as { count?: number } | number | undefined;
      const answerNum = typeof answer === "number" ? answer : Number(answer?.count ?? 0);
      const isCorrect = answerNum === data.correctAnswer;
      return {
        isCorrect,
        explanation: isCorrect
          ? `Benar, ada ${data.correctAnswer} objek.`
          : `Masih belum tepat. Jumlah yang benar: ${data.correctAnswer}.`,
        hint: isCorrect
          ? undefined
          : "Hitung perlahan satu per satu.",
      };
    }

    case "MATCH": {
      const data = activityData as unknown as MatchData;
      const pairs = childAnswer as Record<string, string> | undefined;
      if (!pairs || typeof pairs !== "object") {
        return { isCorrect: false, explanation: "Pasangan tidak lengkap." };
      }
      let allCorrect = true;
      for (const [leftId, rightId] of Object.entries(data.correctPairs)) {
        if (pairs[leftId] !== rightId) {
          allCorrect = false;
          break;
        }
      }
      return {
        isCorrect: allCorrect,
        explanation: allCorrect
          ? "Semua pasangan cocok!"
          : "Masih ada yang belum cocok, coba lagi.",
        hint: allCorrect ? undefined : "Periksa setiap pasangan dengan teliti.",
      };
    }

    case "SEQUENCE": {
      const data = activityData as unknown as SequenceData;
      const order = childAnswer as string[] | undefined;
      if (!Array.isArray(order) || order.length !== data.items.length) {
        return { isCorrect: false, explanation: "Urutan tidak lengkap." };
      }
      let allCorrect = true;
      for (let i = 0; i < order.length; i++) {
        const item = data.items.find((it) => it.id === order[i]);
        if (!item || item.correctPosition !== i) {
          allCorrect = false;
          break;
        }
      }
      return {
        isCorrect: allCorrect,
        explanation: allCorrect
          ? "Urutan sempurna!"
          : "Urutan belum tepat, coba susun lagi.",
        hint: allCorrect ? undefined : "Perhatikan urutan yang logis.",
      };
    }

    case "IDENTIFY_COLOR": {
      const data = activityData as unknown as IdentifyColorData;
      const answer = childAnswer as { id?: string } | string | undefined;
      const answerId = typeof answer === "string" ? answer : String(answer?.id ?? "");
      const correctOpt = data.options.find((o) => o.isCorrect);
      const isCorrect = correctOpt?.id === answerId;
      return {
        isCorrect,
        explanation: isCorrect
          ? `Benar, itu warna ${data.targetColorName}!`
          : `Belum tepat. Warna yang dicari: ${data.targetColorName}.`,
        hint: isCorrect ? undefined : `Cari warna ${data.targetColorName}.`,
      };
    }

    case "IDENTIFY_SHAPE": {
      const data = activityData as unknown as IdentifyShapeData;
      const answer = childAnswer as { id?: string } | string | undefined;
      const answerId = typeof answer === "string" ? answer : String(answer?.id ?? "");
      const correctOpt = data.options.find((o) => o.isCorrect);
      const isCorrect = correctOpt?.id === answerId;
      return {
        isCorrect,
        explanation: isCorrect
          ? `Tepat, itu ${data.targetShapeName}!`
          : `Belum tepat. Bentuk yang dicari: ${data.targetShapeName}.`,
        hint: isCorrect ? undefined : `Cari bentuk ${data.targetShapeName}.`,
      };
    }

    case "MULTIPLE_CHOICE": {
      const data = activityData as unknown as MultipleChoiceData;
      const answer = childAnswer as { ids?: string[]; id?: string } | string[] | string | undefined;
      let answerIds: string[];
      if (Array.isArray(answer)) {
        answerIds = answer.map(String);
      } else if (answer && typeof answer === "object" && "ids" in answer && Array.isArray(answer.ids)) {
        answerIds = answer.ids.map(String);
      } else {
        const fallbackId = answer && typeof answer === "object" ? answer.id : answer;
        answerIds = [String(fallbackId ?? "")];
      }
      const correctIds = data.options.filter((o) => o.isCorrect).map((o) => o.id);
      const isCorrect =
        answerIds.length === correctIds.length &&
        answerIds.every((id) => correctIds.includes(id));
      return {
        isCorrect,
        explanation: isCorrect
          ? "Jawaban benar!"
          : "Masih belum tepat, coba lagi.",
        hint: isCorrect ? undefined : "Baca pilihan dengan teliti.",
      };
    }

    case "TRUE_FALSE": {
      const data = activityData as unknown as TrueFalseData;
      const answer = childAnswer as { value?: boolean } | boolean | undefined;
      const answerBool = typeof answer === "boolean" ? answer : Boolean(answer?.value);
      const isCorrect = answerBool === data.correctAnswer;
      return {
        isCorrect,
        explanation: isCorrect
          ? "Benar!"
          : `Salah. Pernyataan ini ${data.correctAnswer ? "benar" : "salah"}.`,
        hint: isCorrect ? undefined : "Pikirkan lagi sebelum menjawab.",
      };
    }

    default:
      throw new Error(`Unknown activity type for validation: ${activityType}`);
  }
}

// ============================================================
// Activity Renderer Input (what the renderer receives)
// ============================================================

export interface ActivityRenderInput {
  activityId: string;
  type: ActivityType;
  prompt: string;
  data: ActivityData;
  /** Optional: explanation from DB (shown after correct/incorrect) */
  explanation?: string | null;
  /** Child's age (for adaptive presentation) */
  childAge: number;
  /** Whether audio is enabled */
  audioEnabled: boolean;
  /** Whether reduced motion is enabled */
  reducedMotion: boolean;
}

// ============================================================
// Test Fixtures (VRD 6.15 - minimal set for each type)
// ============================================================

export const activityTestFixtures: Record<ActivityType, ActivityData> = {
  TAP_ANSWER: {
    type: "tap_answer",
    items: [
      { id: "a", label: "🍎", value: "apel", isCorrect: true },
      { id: "b", label: "🍌", value: "pisang", isCorrect: false },
      { id: "c", label: "🍇", value: "anggur", isCorrect: false },
    ],
  },
  COUNT_OBJECTS: {
    type: "count_objects",
    objects: [
      { id: "o1", visualKey: "star", count: 3 },
      { id: "o2", visualKey: "star", count: 2 },
    ],
    correctAnswer: 5,
    maxAnswer: 10,
  },
  MATCH: {
    type: "match",
    left: [
      { id: "l1", label: "1", visualKey: "number-1" },
      { id: "l2", label: "2", visualKey: "number-2" },
    ],
    right: [
      { id: "r1", label: "🍎", visualKey: "apple" },
      { id: "r2", label: "🍎🍎", visualKey: "apples-2" },
    ],
    correctPairs: { l1: "r1", l2: "r2" },
  },
  SEQUENCE: {
    type: "sequence",
    items: [
      { id: "s1", label: "1", visualKey: "number-1", correctPosition: 0 },
      { id: "s2", label: "2", visualKey: "number-2", correctPosition: 1 },
      { id: "s3", label: "3", visualKey: "number-3", correctPosition: 2 },
    ],
  },
  IDENTIFY_COLOR: {
    type: "identify_color",
    targetColorName: "merah",
    options: [
      { id: "c1", colorValue: "#FF0000", colorName: "merah", isCorrect: true },
      { id: "c2", colorValue: "#0000FF", colorName: "biru", isCorrect: false },
      { id: "c3", colorValue: "#00FF00", colorName: "hijau", isCorrect: false },
    ],
  },
  IDENTIFY_SHAPE: {
    type: "identify_shape",
    targetShapeName: "lingkaran",
    options: [
      { id: "sh1", shapeKey: "circle", shapeName: "lingkaran", isCorrect: true },
      { id: "sh2", shapeKey: "square", shapeName: "persegi", isCorrect: false },
      { id: "sh3", shapeKey: "triangle", shapeName: "segitiga", isCorrect: false },
    ],
  },
  MULTIPLE_CHOICE: {
    type: "multiple_choice",
    question: "Buah apa yang berwarna kuning?",
    options: [
      { id: "m1", label: "Pisang", isCorrect: true },
      { id: "m2", label: "Apel", isCorrect: false },
      { id: "m3", label: "Anggur", isCorrect: false },
    ],
  },
  TRUE_FALSE: {
    type: "true_false",
    statement: "Hari memiliki 24 jam",
    correctAnswer: true,
    trueLabel: "Benar",
    falseLabel: "Salah",
  },
};