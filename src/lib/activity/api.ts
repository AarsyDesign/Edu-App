/**
 * Activity API — lapisan data baca aktivitas (VRD Phase 6–7).
 * Query aktivitas published untuk child mode.
 */
import type { Db } from "../db/index.ts";

export interface PublishedActivity {
  activityId: string;
  skillId: string;
  learningAreaId: string;
  learningAreaCode: string;
  learningAreaTitle: string;
  targetAgeMin: number;
  targetAgeMax: number;
  difficulty: number;
  prompt: string;
  interactionType: string;
  correctAnswer: unknown;
  explanation: string | null;
  contentOrigin: string;
  reviewStatus: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Semua aktivitas PUBLISHED yang cocok usia anak (target_age_min <= age <= target_age_max). */
export async function listPublishedActivitiesForAge(
  db: Db,
  childAge: number,
): Promise<PublishedActivity[]> {
  const rows = await db.query<{
    id: string;
    skill_id: string;
    learning_area_id: string;
    learning_area_code: string;
    learning_area_title: string;
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
  }>(
    `SELECT a.id, a.skill_id, a.learning_area_id,
            la.code AS learning_area_code,
            la.title AS learning_area_title,
            a.target_age_min, a.target_age_max, a.difficulty,
            a.prompt, a.interaction_type, a.correct_answer,
            a.explanation, a.content_origin, a.review_status,
            a.version, a.created_at, a.updated_at
       FROM activity a
       JOIN learning_area la ON la.id = a.learning_area_id
      WHERE la.is_active = true
        AND a.review_status = 'PUBLISHED'
        AND a.target_age_min <= $1
        AND a.target_age_max >= $1
      ORDER BY la.sort_order ASC, a.difficulty ASC, a.created_at ASC`,
    [childAge],
  );

  return rows.rows.map((r) => ({
    activityId: r.id,
    skillId: r.skill_id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: r.learning_area_code,
    learningAreaTitle: r.learning_area_title,
    targetAgeMin: r.target_age_min,
    targetAgeMax: r.target_age_max,
    difficulty: r.difficulty,
    prompt: r.prompt,
    interactionType: r.interaction_type,
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
    contentOrigin: r.content_origin,
    reviewStatus: r.review_status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Aktivitas published per learning area + usia. */
export async function listPublishedActivitiesForAreaAndAge(
  db: Db,
  learningAreaId: string,
  childAge: number,
): Promise<PublishedActivity[]> {
  const rows = await db.query<{
    id: string;
    skill_id: string;
    learning_area_id: string;
    learning_area_code: string;
    learning_area_title: string;
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
  }>(
    `SELECT a.id, a.skill_id, a.learning_area_id,
            la.code AS learning_area_code,
            la.title AS learning_area_title,
            a.target_age_min, a.target_age_max, a.difficulty,
            a.prompt, a.interaction_type, a.correct_answer,
            a.explanation, a.content_origin, a.review_status,
            a.version, a.created_at, a.updated_at
       FROM activity a
       JOIN learning_area la ON la.id = a.learning_area_id
      WHERE a.learning_area_id = $1::uuid
        AND la.is_active = true
        AND a.review_status = 'PUBLISHED'
        AND a.target_age_min <= $2
        AND a.target_age_max >= $2
      ORDER BY a.difficulty ASC, a.created_at ASC, a.id ASC`,
    [learningAreaId, childAge],
  );

  return rows.rows.map((r) => ({
    activityId: r.id,
    skillId: r.skill_id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: r.learning_area_code,
    learningAreaTitle: r.learning_area_title,
    targetAgeMin: r.target_age_min,
    targetAgeMax: r.target_age_max,
    difficulty: r.difficulty,
    prompt: r.prompt,
    interactionType: r.interaction_type,
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
    contentOrigin: r.content_origin,
    reviewStatus: r.review_status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Ambil satu aktivitas published by ID (untuk renderer halaman aktivitas). */
export async function getPublishedActivityById(
  db: Db,
  activityId: string,
): Promise<PublishedActivity | null> {
  const rows = await db.query<{
    id: string;
    skill_id: string;
    learning_area_id: string;
    learning_area_code: string;
    learning_area_title: string;
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
  }>(
    `SELECT a.id, a.skill_id, a.learning_area_id,
            la.code AS learning_area_code,
            la.title AS learning_area_title,
            a.target_age_min, a.target_age_max, a.difficulty,
            a.prompt, a.interaction_type, a.correct_answer,
            a.explanation, a.content_origin, a.review_status,
            a.version, a.created_at, a.updated_at
       FROM activity a
       JOIN learning_area la ON la.id = a.learning_area_id
      WHERE a.id = $1::uuid
        AND la.is_active = true
        AND a.review_status = 'PUBLISHED'`,
    [activityId],
  );

  if (rows.rows.length === 0) return null;
  const r = rows.rows[0];
  return {
    activityId: r.id,
    skillId: r.skill_id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: r.learning_area_code,
    learningAreaTitle: r.learning_area_title,
    targetAgeMin: r.target_age_min,
    targetAgeMax: r.target_age_max,
    difficulty: r.difficulty,
    prompt: r.prompt,
    interactionType: r.interaction_type,
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
    contentOrigin: r.content_origin,
    reviewStatus: r.review_status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}