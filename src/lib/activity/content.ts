/**
 * Pemetaan baris `activity` + `activity_option` → `ActivityData` (VRD 6.13,
 * 6.14 — render type-driven & payload invalid gagal dengan aman).
 *
 * Konvensi penyimpanan yang dipakai (diturunkan dari skema migrasi 0001 +
 * kontrak `ActivityOption` di domain.ts, bukan format baru):
 *
 * 1. Bila `activity.correct_answer` menyimpan objek `ActivityData` utuh
 *    (memiliki kunci `type`), objek itu dipakai langsung — divalidasi
 *    `validateActivityData` supaya payload rusak tidak pernah sampai ke layar.
 * 2. Kalau bukan, data dirakit dari baris `activity_option` (urut `position`),
 *    sesuai komentar skema: "untuk tipe berbasis pilihan, kebenaran ditandai
 *    di activity_option.is_correct". Jawaban non-pilihan (COUNT_OBJECTS,
 *    TRUE_FALSE) tetap diambil dari `activity.correct_answer`.
 * 3. Tipe yang tidak bisa dirakit dengan yakin → `null` (gagal aman, VRD 6.14),
 *    layar menampilkan keadaan "aktivitas belum siap" tanpa membocorkan isi.
 *
 * Tipe MATCH sengaja tidak dirakit dari `activity_option`: pemetaan sisi
 * kiri/kanan dan pasangan benar tidak terbaca dari skema tanpa format payload
 * tambahan — lihat OPEN QUESTION di docs/IMPLEMENTATION-AUDIT.md.
 */
import type { Db } from "../db/index.ts";
import type { ActivityData, ActivityType } from "./domain.ts";
import { validateActivityData } from "./domain.ts";

export interface ActivityOptionRow {
  id: string;
  position: number;
  payload: Record<string, unknown>;
  isCorrect: boolean;
}

/** Baris `activity_option` untuk satu aktivitas, urut posisi. */
export async function loadActivityOptions(
  db: Db,
  activityId: string,
): Promise<ActivityOptionRow[]> {
  const rows = await db.query<{
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

  return rows.rows.map((r) => ({
    id: r.id,
    position: r.position,
    payload: r.payload && typeof r.payload === "object" ? r.payload : {},
    isCorrect: r.is_correct === true,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface BuildInput {
  type: ActivityType;
  prompt: string;
  correctAnswer: unknown;
  options: ActivityOptionRow[];
}

/**
 * Susun `ActivityData` untuk satu aktivitas. Mengembalikan `null` bila isi
 * tidak valid/belum didukung — pemanggil wajib memperlakukan `null` sebagai
 * "aktivitas belum siap", bukan mengisi sendiri (VRD 6.14).
 */
export function buildActivityData(input: BuildInput): ActivityData | null {
  const { type, prompt, correctAnswer, options } = input;

  // Jalur 1: `correct_answer` memuat objek ActivityData utuh.
  if (isRecord(correctAnswer) && typeof correctAnswer.type === "string") {
    const whole = tryValidate(type, correctAnswer);
    if (whole) return whole;
  }

  try {
    const assembled = assembleFromOptions(type, prompt, correctAnswer, options);
    return assembled ? validateActivityData(type, assembled) : null;
  } catch {
    return null;
  }
}

function tryValidate(type: ActivityType, payload: unknown): ActivityData | null {
  try {
    return validateActivityData(type, payload);
  } catch {
    return null;
  }
}

function assembleFromOptions(
  type: ActivityType,
  prompt: string,
  correctAnswer: unknown,
  options: ActivityOptionRow[],
): Record<string, unknown> | null {
  const meta = isRecord(correctAnswer) ? correctAnswer : {};
  const lower = type.toLowerCase();

  switch (type) {
    case "TAP_ANSWER":
      if (options.length < 2) return null;
      return {
        type: lower,
        items: options.map((o) => ({
          id: o.id,
          label: str(o.payload.label),
          ...(typeof o.payload.value === "string" ? { value: o.payload.value } : {}),
          isCorrect: o.isCorrect,
        })),
      };

    case "COUNT_OBJECTS": {
      const total = num(isRecord(correctAnswer) ? correctAnswer.correctAnswer : correctAnswer);
      if (total === null || total < 0 || options.length === 0) return null;
      const objects = options.map((o) => ({
        id: o.id,
        visualKey: str(o.payload.visualKey),
        count: num(o.payload.count),
      }));
      if (objects.some((o) => !o.visualKey || o.count === null)) return null;
      const maxAnswer = num(meta.maxAnswer);
      return {
        type: lower,
        objects,
        correctAnswer: total,
        ...(maxAnswer !== null && maxAnswer >= 0 ? { maxAnswer } : {}),
      };
    }

    case "SEQUENCE":
      if (options.length < 2) return null;
      return {
        type: lower,
        items: options.map((o) => ({
          id: o.id,
          label: str(o.payload.label),
          ...(typeof o.payload.visualKey === "string" ? { visualKey: o.payload.visualKey } : {}),
          correctPosition: o.position,
        })),
      };

    case "IDENTIFY_COLOR": {
      if (options.length < 2) return null;
      const correctOption = options.find((o) => o.isCorrect);
      if (!correctOption) return null;
      const target = str(meta.targetColorName, str(correctOption.payload.colorName));
      if (!target) return null;
      return {
        type: lower,
        targetColorName: target,
        options: options.map((o) => ({
          id: o.id,
          colorValue: str(o.payload.colorValue),
          colorName: str(o.payload.colorName),
          isCorrect: o.isCorrect,
        })),
      };
    }

    case "IDENTIFY_SHAPE": {
      if (options.length < 2) return null;
      const correctOption = options.find((o) => o.isCorrect);
      if (!correctOption) return null;
      const target = str(meta.targetShapeName, str(correctOption.payload.shapeName));
      if (!target) return null;
      return {
        type: lower,
        targetShapeName: target,
        options: options.map((o) => ({
          id: o.id,
          shapeKey: str(o.payload.shapeKey),
          shapeName: str(o.payload.shapeName),
          isCorrect: o.isCorrect,
        })),
      };
    }

    case "MULTIPLE_CHOICE":
      if (options.length < 2) return null;
      return {
        type: lower,
        question: prompt,
        options: options.map((o) => ({
          id: o.id,
          label: str(o.payload.label),
          isCorrect: o.isCorrect,
        })),
      };

    case "TRUE_FALSE": {
      // Hanya boolean JSON (CONTENT-SPEC §7.3): dulu angka/teks dipaksa
      // Boolean(...) sehingga "false" terbaca true dan jawaban benar anak
      // bisa dinilai salah diam-diam. Salah tipe → gagal aman (VRD 6.14).
      if (typeof correctAnswer !== "boolean" || !prompt) return null;
      return { type: lower, statement: prompt, correctAnswer };
    }

    case "MATCH":
    default:
      // Sisi kiri/kanan & pasangan benar tidak terbaca dari skema tanpa
      // format payload tambahan → gagal aman, jangan menebak.
      return null;
  }
}
