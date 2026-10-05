/**
 * Progress & Recommendation Engine (VRD Phase 7, 9).
 * Logika sederhana deterministik: ambil aktivitas published pertama yang belum
 * dijawab benar, urut learning_area.sort_order + difficulty.
 * Bisa diperluas Phase 9 dengan mastery threshold, spacing, dll.
 */
import type { Db } from "../db/index.ts";
import { listPublishedActivitiesForAge } from "../activity/api.ts";

export interface RecommendationResult {
  activityId: string;
  learningAreaId: string;
  learningAreaTitle: string;
  learningAreaCode: string;
  skillId: string;
  prompt: string;
  activityType: string;
  difficulty: number;
  targetAgeMin: number;
  targetAgeMax: number;
}

/** Progres per skill untuk anak: attempts, correct, last_practiced. */
export interface SkillProgress {
  skillId: string;
  attemptsCount: number;
  correctCount: number;
  lastPracticedAt: Date | null;
  masteredAt: Date | null;
}

/** Ambil progress anak untuk daftar skill. */
export async function getChildSkillProgress(
  db: Db,
  childId: string,
  skillIds: string[],
): Promise<Map<string, SkillProgress>> {
  if (skillIds.length === 0) return new Map();

  const placeholders = skillIds.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.query<{
    skill_id: string;
    attempts_count: number;
    correct_count: number;
    last_practiced_at: Date | null;
    mastered_at: Date | null;
  }>(
    `SELECT skill_id, attempts_count, correct_count, last_practiced_at, mastered_at
       FROM learning_progress
      WHERE child_id = $1::uuid
        AND skill_id IN (${placeholders})`,
    [childId, ...skillIds],
  );

  const map = new Map<string, SkillProgress>();
  for (const r of rows.rows) {
    map.set(r.skill_id, {
      skillId: r.skill_id,
      attemptsCount: r.attempts_count,
      correctCount: r.correct_count,
      lastPracticedAt: r.last_practiced_at,
      masteredAt: r.mastered_at,
    });
  }
  return map;
}

/** Rekomendasi aktivitas berikutnya:
 * 1. Ambil semua aktivitas published cocok usia
 * 2. Filter yang skill-nya BELUM mastered (mastered_at IS NULL)
 * 3. Urut: learning_area.sort_order ASC, activity.difficulty ASC, created_at ASC
 * 4. Return yang pertama.
 * Bila semua skill sudah mastered → return null (Phase 9 handle). */
export async function getNextRecommendation(
  db: Db,
  childId: string,
  childAge: number,
): Promise<RecommendationResult | null> {
  // 1. Semua aktivitas published untuk usia anak
  const activities = await listPublishedActivitiesForAge(db, childAge);
  if (activities.length === 0) return null;

  // 2. Kumpulkan skill IDs unik
  const skillIds = [...new Set(activities.map((a) => a.skillId))];

  // 3. Progress skill anak
  const progressMap = await getChildSkillProgress(db, childId, skillIds);

  // 4. Filter: skill belum mastered
  const candidates = activities.filter((act) => {
    const prog = progressMap.get(act.skillId);
    return !prog || prog.masteredAt === null;
  });

  if (candidates.length === 0) return null;

  // 5. Sudah urut dari query (sort_order, difficulty, created_at)
  const next = candidates[0];
  return {
    activityId: next.activityId,
    learningAreaId: next.learningAreaId,
    learningAreaTitle: next.learningAreaTitle,
    learningAreaCode: next.learningAreaCode,
    skillId: next.skillId,
    prompt: next.prompt,
    activityType: next.interactionType,
    difficulty: next.difficulty,
    targetAgeMin: next.targetAgeMin,
    targetAgeMax: next.targetAgeMax,
  };
}

/** Progress ringkas per learning area untuk tampilan journey. */
export interface AreaProgressSummary {
  attempted: number;   // unique skills attempted
  completed: number;   // skills mastered
  total: number;       // total skills in area (published activities)
}

export async function getAreaProgress(
  db: Db,
  childId: string,
  areaIds: string[],
): Promise<Record<string, AreaProgressSummary>> {
  const result: Record<string, AreaProgressSummary> = {};

  // Total skills per area (dari published activities)
  for (const areaId of areaIds) {
    const actRows = await db.query<{ skill_id: string }>(
      `SELECT DISTINCT a.skill_id
         FROM activity a
         JOIN learning_area la ON la.id = a.learning_area_id
        WHERE a.learning_area_id = $1::uuid
          AND la.is_active = true
          AND a.review_status = 'PUBLISHED'`,
      [areaId],
    );
    const totalSkills = new Set(actRows.rows.map((r) => r.skill_id)).size;

    // Progress anak di area ini
    const progRows = await db.query<{
      skill_id: string;
      attempts_count: number;
      correct_count: number;
      mastered_at: Date | null;
    }>(
      `SELECT lp.skill_id, lp.attempts_count, lp.correct_count, lp.mastered_at
         FROM learning_progress lp
         JOIN skill s ON s.id = lp.skill_id
        WHERE lp.child_id = $1::uuid
          AND s.learning_area_id = $2::uuid`,
      [childId, areaId],
    );

    let attempted = 0;
    let completed = 0;
    for (const p of progRows.rows) {
      if (p.attempts_count > 0) attempted++;
      if (p.mastered_at !== null) completed++;
    }

    result[areaId] = { attempted, completed, total: totalSkills };
  }

  return result;
}