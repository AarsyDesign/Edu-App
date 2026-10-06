/**
 * Ringkasan progres siap-baca orang tua (VRD 9.8).
 *
 * Modul ini hanya MENGAGREGASI fakta dari mesin yang sudah ada:
 * `getSkillAccuracy` + `getRecentPerformance` (engine.ts), `getAreaProgress`
 * (recommendation.ts), dan hitungan sesi dari `learning_session`. Tidak ada
 * ambang baru, tidak ada label lulus/gagal/peringkat (VRD 9.6/9.7, PRD §9),
 * dan tidak ada tulisan — pemanggil yang bertanggung jawab atas sesi +
 * kepemilikan (`getChildForParent`, VRD 3.7) sebelum memanggil fungsi ini.
 *
 * Angka kosong tidak dipaksa keluar: akurasi `null` bila belum ada percobaan,
 * durasi `null` bila belum ada sesi tertutup.
 */
import type { Db } from "../db/index.ts";
import type { ChildRecord } from "../auth/guard.ts";
import {
  getRecentPerformance,
  getSkillAccuracy,
  type RecentPerformance,
  type SkillAccuracy,
} from "./engine.ts";
import { getAreaProgress, getNextRecommendation, type RecommendationResult } from "./recommendation.ts";
import { listLearningAreas } from "../learning/areas-skills.ts";

/** Satu baris ringkasan per learning area (PRD §12: skill progress per area). */
export interface AreaSummary {
  areaId: string;
  code: string;
  title: string;
  /** Skill dengan ≥1 percobaan. */
  attempted: number;
  /** Skill yang sudah dikuasai (`mastered_at` terisi). */
  completed: number;
  /** Total skill pada area dari aktivitas PUBLISHED. */
  totalSkills: number;
}

/** Hitungan sesi belajar (bukan asesmen dasar) + sesi asesmen terpisah. */
export interface SessionSummary {
  /** Sesi belajar yang sudah ditutup. */
  completed: number;
  /** Sesi belajar yang masih terbuka. */
  open: number;
  /** Sesi asesmen dasar (penanda `started_at = ended_at`, Phase 8). */
  baseline: number;
  /** Seluruh baris `learning_session` milik anak ini. */
  total: number;
  /** Total durasi sesi belajar tertutup dalam ms; `null` bila belum ada. */
  totalDurationMs: number | null;
  /** Waktu penutupan sesi belajar terakhir; `null` bila belum pernah. */
  lastEndedAt: Date | null;
}

/** Ringkasan progres satu anak untuk ditampilkan orang tua (VRD 9.8). */
export interface ParentProgressSummary {
  childId: string;
  /** Fakta total dari `learning_progress` (menjumlahkan seluruh riwayat). */
  totals: {
    attempts: number;
    correct: number;
    /** `correct / attempts`, atau `null` bila belum ada percobaan. */
    accuracy: number | null;
    /** Jumlah skill yang punya baris progres dengan ≥1 percobaan. */
    skillsPracticed: number;
  };
  areas: AreaSummary[];
  /** Akurasi per skill (urut `skillId`) — bahan "skill progress". */
  skills: SkillAccuracy[];
  /** Performa terkini berjendela (VRD 9.4) + sebaran jawaban salah. */
  recent: RecentPerformance;
  sessions: SessionSummary;
  lastPracticedAt: Date | null;
  /** Saran latihan berikutnya (VRD 9.5); `null` bila tidak ada kandidat. */
  nextRecommendation: RecommendationResult | null;
}

interface Totals {
  attempts: number;
  correct: number;
  skillsPracticed: number;
  lastPracticedAt: Date | null;
}

async function loadTotals(db: Db, childId: string): Promise<Totals> {
  const row = await db.query<{
    attempts: number | null;
    correct: number | null;
    practiced: number | null;
    last: Date | null;
  }>(
    `SELECT COALESCE(SUM(attempts_count), 0) AS attempts,
            COALESCE(SUM(correct_count), 0) AS correct,
            COUNT(CASE WHEN attempts_count > 0 THEN 1 END) AS practiced,
            MAX(last_practiced_at) AS last
       FROM learning_progress
      WHERE child_id = $1::uuid`,
    [childId],
  );
  const r = row.rows[0];
  return {
    attempts: Number(r?.attempts ?? 0),
    correct: Number(r?.correct ?? 0),
    skillsPracticed: Number(r?.practiced ?? 0),
    lastPracticedAt: r?.last ?? null,
  };
}

async function loadSessions(db: Db, childId: string): Promise<SessionSummary> {
  const row = await db.query<{
    completed: number | null;
    open: number | null;
    baseline: number | null;
    total: number | null;
    duration_ms: number | null;
    last_ended: Date | null;
  }>(
    `SELECT
       COUNT(CASE WHEN ended_at IS NOT NULL AND ended_at <> started_at THEN 1 END) AS completed,
       COUNT(CASE WHEN ended_at IS NULL THEN 1 END) AS open,
       COUNT(CASE WHEN ended_at IS NOT NULL AND ended_at = started_at THEN 1 END) AS baseline,
       COUNT(*) AS total,
       SUM(
         CASE
           WHEN ended_at IS NOT NULL AND ended_at <> started_at
           THEN EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000
           ELSE NULL
         END
       ) AS duration_ms,
       MAX(CASE WHEN ended_at IS NOT NULL AND ended_at <> started_at THEN ended_at END) AS last_ended
     FROM learning_session
    WHERE child_id = $1::uuid`,
    [childId],
  );
  const r = row.rows[0];
  const durationMs = r?.duration_ms === null || r?.duration_ms === undefined
    ? null
    : Math.round(Number(r.duration_ms));
  return {
    completed: Number(r?.completed ?? 0),
    open: Number(r?.open ?? 0),
    baseline: Number(r?.baseline ?? 0),
    total: Number(r?.total ?? 0),
    totalDurationMs: durationMs === null || Number.isNaN(durationMs) ? null : durationMs,
    lastEndedAt: r?.last_ended ?? null,
  };
}

/**
 * Susun ringkasan progres untuk satu anak.
 *
 * `options.window` mengikuti aturan `getRecentPerformance`: nilai di luar
 * 1..RECENT_WINDOW_MAX jatuh ke jendela bawaan, bukan ke nol.
 */
export async function getParentProgressSummary(
  db: Db,
  child: Pick<ChildRecord, "childId" | "age">,
  options: { window?: number } = {},
): Promise<ParentProgressSummary> {
  const childId = child.childId;

  const [totals, recent, sessionSummary] = await Promise.all([
    loadTotals(db, childId),
    getRecentPerformance(db, childId, { window: options.window }),
    loadSessions(db, childId),
  ]);

  const learningAreas = await listLearningAreas(db);
  const areaProgress = await getAreaProgress(
    db,
    childId,
    learningAreas.map((a) => a.areaId),
  );

  const areas: AreaSummary[] = learningAreas.map((a) => ({
    areaId: a.areaId,
    code: a.code,
    title: a.title,
    attempted: areaProgress[a.areaId]?.attempted ?? 0,
    completed: areaProgress[a.areaId]?.completed ?? 0,
    totalSkills: areaProgress[a.areaId]?.total ?? 0,
  }));

  const skills = await getSkillAccuracy(db, childId);
  const nextRecommendation = await getNextRecommendation(db, childId, child.age);

  return {
    childId,
    totals: {
      attempts: totals.attempts,
      correct: totals.correct,
      accuracy: totals.attempts > 0 ? totals.correct / totals.attempts : null,
      skillsPracticed: totals.skillsPracticed,
    },
    areas,
    skills,
    recent,
    sessions: sessionSummary,
    lastPracticedAt: totals.lastPracticedAt,
    nextRecommendation,
  };
}
