/**
 * Learning Area & Skill — lapisan data baca-saja (VRD Phase 5).
 *
 * Kebutuhan: PRD §4 (enam learning area), VRD 5.1–5.6 (seed, age suitability,
 * difficulty, prerequisite, content-configurable not hardcoded).
 *
 * Modul ini HANYA menyediakan query baca. Penulisan (seed, edit, delete)
 * dilakukan lewat migrasi / content workflow (Phase 11) — bukan endpoint publik.
 */
import type { Db } from "../db/index.ts";

export interface LearningArea {
  areaId: string;
  code: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  skillId: string;
  learningAreaId: string;
  learningAreaCode: string;
  code: string;
  title: string;
  description: string | null;
  ageMin: number;
  ageMax: number;
  difficulty: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillWithArea extends Skill {
  learningAreaTitle: string;
}

/** Semua learning area aktif, urut sort_order. */
export async function listLearningAreas(db: Db): Promise<LearningArea[]> {
  const rows = await db.query<{
    id: string;
    code: string;
    title: string;
    sort_order: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, code, title, sort_order, is_active, created_at, updated_at
       FROM learning_area
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC`,
  );
  return rows.rows.map((r) => ({
    areaId: r.id,
    code: r.code,
    title: r.title,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Learning area by code (untuk lookup). */
export async function getLearningAreaByCode(
  db: Db,
  code: string,
): Promise<LearningArea | null> {
  const rows = await db.query<{
    id: string;
    code: string;
    title: string;
    sort_order: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, code, title, sort_order, is_active, created_at, updated_at
       FROM learning_area
      WHERE code = $1 AND is_active = true`,
    [code],
  );
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0];
  return {
    areaId: r.id,
    code: r.code,
    title: r.title,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Semua skill untuk satu learning area, urut sort_order. */
export async function listSkillsForArea(
  db: Db,
  learningAreaId: string,
): Promise<Skill[]> {
  const rows = await db.query<{
    id: string;
    learning_area_id: string;
    code: string;
    title: string;
    description: string | null;
    age_min: number;
    age_max: number;
    difficulty: number;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, learning_area_id, code, title, description, age_min, age_max,
            difficulty, sort_order, created_at, updated_at
       FROM skill
      WHERE learning_area_id = $1::uuid
      ORDER BY sort_order ASC, id ASC`,
    [learningAreaId],
  );
  return rows.rows.map((r) => ({
    skillId: r.id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: "",
    code: r.code,
    title: r.title,
    description: r.description,
    ageMin: r.age_min,
    ageMax: r.age_max,
    difficulty: r.difficulty,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Skill by code within a learning area. */
export async function getSkillByCode(
  db: Db,
  learningAreaId: string,
  code: string,
): Promise<Skill | null> {
  const rows = await db.query<{
    id: string;
    learning_area_id: string;
    code: string;
    title: string;
    description: string | null;
    age_min: number;
    age_max: number;
    difficulty: number;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, learning_area_id, code, title, description, age_min, age_max,
            difficulty, sort_order, created_at, updated_at
       FROM skill
      WHERE learning_area_id = $1::uuid AND code = $2`,
    [learningAreaId, code],
  );
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0];
  return {
    skillId: r.id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: "",
    code: r.code,
    title: r.title,
    description: r.description,
    ageMin: r.age_min,
    ageMax: r.age_max,
    difficulty: r.difficulty,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Semua skill + learning area title (untuk daftar lengkap / admin). */
export async function listAllSkillsWithArea(db: Db): Promise<SkillWithArea[]> {
  const rows = await db.query<{
    id: string;
    learning_area_id: string;
    learning_area_code: string;
    learning_area_title: string;
    code: string;
    title: string;
    description: string | null;
    age_min: number;
    age_max: number;
    difficulty: number;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT s.id, s.learning_area_id, la.code AS learning_area_code,
            la.title AS learning_area_title,
            s.code, s.title, s.description, s.age_min, s.age_max,
            s.difficulty, s.sort_order, s.created_at, s.updated_at
       FROM skill s
       JOIN learning_area la ON la.id = s.learning_area_id
      WHERE la.is_active = true
      ORDER BY la.sort_order ASC, s.sort_order ASC, s.id ASC`,
  );
  return rows.rows.map((r) => ({
    skillId: r.id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: r.learning_area_code,
    learningAreaTitle: r.learning_area_title,
    code: r.code,
    title: r.title,
    description: r.description,
    ageMin: r.age_min,
    ageMax: r.age_max,
    difficulty: r.difficulty,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Skill yang cocok untuk usia anak (age_min <= childAge <= age_max). */
export async function listSkillsForAge(
  db: Db,
  childAge: number,
): Promise<SkillWithArea[]> {
  const rows = await db.query<{
    id: string;
    learning_area_id: string;
    learning_area_code: string;
    learning_area_title: string;
    code: string;
    title: string;
    description: string | null;
    age_min: number;
    age_max: number;
    difficulty: number;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT s.id, s.learning_area_id, la.code AS learning_area_code,
            la.title AS learning_area_title,
            s.code, s.title, s.description, s.age_min, s.age_max,
            s.difficulty, s.sort_order, s.created_at, s.updated_at
       FROM skill s
       JOIN learning_area la ON la.id = s.learning_area_id
      WHERE la.is_active = true
        AND s.age_min <= $1
        AND s.age_max >= $1
      ORDER BY la.sort_order ASC, s.difficulty ASC, s.sort_order ASC, s.id ASC`,
    [childAge],
  );
  return rows.rows.map((r) => ({
    skillId: r.id,
    learningAreaId: r.learning_area_id,
    learningAreaCode: r.learning_area_code,
    learningAreaTitle: r.learning_area_title,
    code: r.code,
    title: r.title,
    description: r.description,
    ageMin: r.age_min,
    ageMax: r.age_max,
    difficulty: r.difficulty,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}