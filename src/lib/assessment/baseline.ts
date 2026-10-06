/**
 * Baseline Assessment Engine — VRD Phase 8
 *
 * Short assessment (5-10 activities) to estimate starting level.
 * Age determines initial pool, assessment refines starting point.
 * Result does not shame child — no pass/fail labels.
 */
import type { Db } from "../db/index.ts";
import { listPublishedActivitiesForAge } from "../activity/api.ts";
import { listSkillsForAge } from "../learning/areas-skills.ts";

export interface BaselineActivity {
  activityId: string;
  skillId: string;
  learningAreaId: string;
  learningAreaCode: string;
  learningAreaTitle: string;
  prompt: string;
  interactionType: string;
  difficulty: number;
  targetAgeMin: number;
  targetAgeMax: number;
  data: unknown;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface BaselineAttempt {
  activityId: string;
  skillId: string;
  learningAreaId: string;
  childAnswer: unknown;
  isCorrect: boolean;
  durationMs?: number;
}

export interface BaselineResult {
  childId: string;
  attempts: BaselineAttempt[];
  skillEstimates: Record<string, { correct: number; total: number; estimatedLevel: number }>;
  recommendedStartingSkills: string[];
  completedAt: Date;
}

/**
 * Pilih aktivitas asesmen dasar untuk usia anak (VRD 8.1, 8.2, 8.8).
 *
 * - 8.1  Kumpulan awal = aktivitas PUBLISHED yang rentang usianya mencakup
 *        `childAge` (usia menentukan kolam awal).
 * - 8.2  "Randomize within controlled difficulty": kandidat diacak dalam
 *        band kesukaran yang dikendalikan (difficulty 1 dulu, lalu 2, 3),
 *        dengan sebaran minimal satu per learning area sebelum mengulang.
 *        Acakannya MEMAKAI seed deterministik (`seed`) supaya GET ulang
 *        mengembalikan kumpulan yang sama untuk anak yang sama — pemanggil
 *        biasanya me-render ulang halaman, dan kumpulan yang berganti akan
 *        membuat jawaban tersimpan tidak nyambung.
 * - 8.8  Pendek: default 8, dibatasi rentang 5–10; bila isi kolam lebih
 *        kecil, yang ada dipakai apa adanya (tidak ada konten yang dikarang).
 *
 * Tidak ada label lulus/gagal di sini (VRD 8.6) — fungsi ini hanya memilih
 * aktivitas.
 */
export async function selectBaselineActivities(
  db: Db,
  childAge: number,
  seed: string,
  count: number = 8,
): Promise<BaselineActivity[]> {
  const pool = await listPublishedActivitiesForAge(db, childAge);
  if (pool.length === 0) return [];

  const target = Math.max(5, Math.min(10, count));
  const rng = mulberry32(fnv1a(seed));

  const candidates: BaselineActivity[] = pool.map((act) => ({
    activityId: act.activityId,
    skillId: act.skillId,
    learningAreaId: act.learningAreaId,
    learningAreaCode: act.learningAreaCode,
    learningAreaTitle: act.learningAreaTitle,
    prompt: act.prompt,
    interactionType: act.interactionType,
    difficulty: act.difficulty,
    targetAgeMin: act.targetAgeMin,
    targetAgeMax: act.targetAgeMax,
    data: act.correctAnswer,
    correctAnswer: act.correctAnswer,
    explanation: act.explanation,
  }));

  // Band kesukaran menaik: 1 → 2 → 3 (kontrol kesukaran, VRD 8.2).
  const bands = new Map<number, BaselineActivity[]>();
  for (const act of candidates) {
    if (!bands.has(act.difficulty)) bands.set(act.difficulty, []);
    bands.get(act.difficulty)!.push(act);
  }

  const selected: BaselineActivity[] = [];
  const usedActivityIds = new Set<string>();
  const usedAreaIds = new Set<string>();

  for (const difficulty of [...bands.keys()].sort((a, b) => a - b)) {
    const band = shuffleSeeded(bands.get(difficulty)!, rng);

    // Putaran 1: satu per learning area yang belum terwakili.
    for (const act of band) {
      if (selected.length >= target) break;
      if (usedActivityIds.has(act.activityId)) continue;
      if (usedAreaIds.has(act.learningAreaId)) continue;
      pushUnique(selected, usedActivityIds, usedAreaIds, act);
    }
    // Putaran 2: isi sisa band bila masih kurang.
    for (const act of band) {
      if (selected.length >= target) break;
      if (usedActivityIds.has(act.activityId)) continue;
      pushUnique(selected, usedActivityIds, usedAreaIds, act);
    }
    if (selected.length >= target) break;
  }

  // Urutan penyajian juga diacak (deterministik untuk seed yang sama).
  return shuffleSeeded(selected, rng).slice(0, target);
}

/** FNV-1a 32-bit — hash string kecil untuk seed PRNG. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** PRNG mulberry32 — deterministik, cukup untuk pemilihan konten. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates memakai rng deterministik — tidak mengubah input asli. */
function shuffleSeeded<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pushUnique(
  selected: BaselineActivity[],
  usedActivityIds: Set<string>,
  usedAreaIds: Set<string>,
  act: BaselineActivity,
): void {
  selected.push(act);
  usedActivityIds.add(act.activityId);
  usedAreaIds.add(act.learningAreaId);
}

/**
 * Calculate skill estimates from baseline attempts.
 * Returns per-skill accuracy and estimated level (1-3).
 */
export function calculateSkillEstimates(
  attempts: BaselineAttempt[],
): Record<string, { correct: number; total: number; estimatedLevel: number }> {
  const bySkill = new Map<string, { correct: number; total: number }>();

  for (const attempt of attempts) {
    const existing = bySkill.get(attempt.skillId) || { correct: 0, total: 0 };
    existing.total += 1;
    if (attempt.isCorrect) existing.correct += 1;
    bySkill.set(attempt.skillId, existing);
  }

  const estimates: Record<string, { correct: number; total: number; estimatedLevel: number }> = {};

  for (const [skillId, { correct, total }] of bySkill) {
    const accuracy = total > 0 ? correct / total : 0;
    let estimatedLevel = 1;
    if (accuracy >= 0.8) estimatedLevel = 3;
    else if (accuracy >= 0.5) estimatedLevel = 2;
    estimates[skillId] = { correct, total, estimatedLevel };
  }

  return estimates;
}

/**
 * Get recommended starting skills based on baseline results.
 * Skills with low accuracy get priority; high accuracy skills may be skipped.
 */
export async function getRecommendedStartingSkills(
  db: Db,
  childId: string,
  childAge: number,
  skillEstimates: Record<string, { correct: number; total: number; estimatedLevel: number }>,
): Promise<string[]> {
  // Get all skills for child's age
  const allSkills = await listSkillsForAge(db, childAge);

  // Filter to skills that have published activities
  const skillsWithActivities: string[] = [];
  for (const skill of allSkills) {
    const activities = await db.query<{ id: string }>(
      `SELECT id FROM activity
       WHERE skill_id = $1::uuid
         AND review_status = 'PUBLISHED'
         AND target_age_min <= $2
         AND target_age_max >= $2
       LIMIT 1`,
      [skill.skillId, childAge],
    );
    if (activities.rows.length > 0) {
      skillsWithActivities.push(skill.skillId);
    }
  }

  // Sort: skills not yet attempted (in baseline) first, then by estimated level ascending
  const attemptedSkillIds = new Set(Object.keys(skillEstimates));
  const sorted = skillsWithActivities.sort((a, b) => {
    const aAttempted = attemptedSkillIds.has(a);
    const bAttempted = attemptedSkillIds.has(b);
    if (aAttempted !== bAttempted) return aAttempted ? 1 : -1;
    const aLevel = skillEstimates[a]?.estimatedLevel ?? 1;
    const bLevel = skillEstimates[b]?.estimatedLevel ?? 1;
    return aLevel - bLevel;
  });

  return sorted;
}

/**
 * Store baseline assessment result.
 * Creates a learning_session with type 'baseline' and stores attempts.
 */
export async function storeBaselineResult(
  db: Db,
  childId: string,
  result: BaselineResult,
): Promise<string> {
  // Create a baseline session
  const sessionResult = await db.query<{ id: string }>(
    `INSERT INTO learning_session (child_id, started_at, ended_at)
     VALUES ($1::uuid, $2, $3)
     RETURNING id`,
    [childId, result.completedAt, result.completedAt],
  );

  const sessionId = sessionResult.rows[0].id;

  // Store each attempt
  for (const attempt of result.attempts) {
    await db.query(
      `INSERT INTO activity_attempt (child_id, session_id, activity_id, attempt_no, answer, is_correct, duration_ms, created_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, $4, $5, $6, $7)`,
      [
        childId,
        sessionId,
        attempt.activityId,
        JSON.stringify(attempt.childAnswer ?? null),
        attempt.isCorrect,
        attempt.durationMs ?? null,
        result.completedAt,
      ],
    );

    // Update learning_progress
    await db.query(
      `INSERT INTO learning_progress (child_id, skill_id, attempts_count, correct_count, last_practiced_at)
       VALUES ($1::uuid, $2::uuid, 1, $3, $4)
       ON CONFLICT (child_id, skill_id) DO UPDATE SET
         attempts_count = learning_progress.attempts_count + 1,
         correct_count = learning_progress.correct_count + EXCLUDED.correct_count,
         last_practiced_at = EXCLUDED.last_practiced_at,
         updated_at = now()`,
      [childId, attempt.skillId, attempt.isCorrect ? 1 : 0, result.completedAt],
    );
  }

  return sessionId;
}

/**
 * Check if child has completed baseline assessment.
 */
export async function hasCompletedBaseline(db: Db, childId: string): Promise<boolean> {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM learning_session
     WHERE child_id = $1::uuid
       AND started_at = ended_at`, // baseline sessions have same start/end
    [childId],
  );
  return Number(result.rows[0].count) > 0;
}