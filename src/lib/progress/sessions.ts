/**
 * Sesi belajar anak (VRD 7.6 mulai sesi, 7.7 sesi selesai).
 *
 * Keputusan: satu sesi dibuka saat anak membuka layar aktivitas dan ditutup
 * saat anak menekan "Beranda" / "Aktivitas Berikutnya". Muat ulang halaman
 * tidak membuka sesi baru — id sesi dibawa lewat query string, jadi refresh
 * memakai sesi yang sama (riwayat sesi tetap bersih untuk Phase 10).
 *
 * Sesi baseline (Phase 8) memakai penanda `started_at = ended_at` dan punya
 * jalur sendiri; fungsi ini tidak menyentuhnya.
 */
import type { Db } from "../db/index.ts";

export interface StartedSession {
  sessionId: string;
  startedAt: Date;
}

/** Buka sesi belajar baru untuk anak. */
export async function startActivitySession(db: Db, childId: string): Promise<StartedSession> {
  const row = await db.query<{ id: string; started_at: Date }>(
    `INSERT INTO learning_session (child_id, started_at)
     VALUES ($1::uuid, now())
     RETURNING id, started_at`,
    [childId],
  );
  return { sessionId: row.rows[0].id, startedAt: row.rows[0].started_at };
}

/**
 * Tutup sesi bila masih terbuka. Mengembalikan `endedAt` yang benar-benar
 * tersimpan (idempoten: menutup sesi yang sudah tertutup tidak mengubah apa
 * pun dan tetap mengembalikan waktu tutupnya).
 */
export async function completeLearningSession(
  db: Db,
  sessionId: string,
): Promise<{ endedAt: Date } | null> {
  const open = await db.query<{ ended_at: Date | null }>(
    `SELECT ended_at FROM learning_session WHERE id = $1::uuid`,
    [sessionId],
  );
  if (open.rows.length === 0) return null;
  if (open.rows[0].ended_at !== null) return { endedAt: open.rows[0].ended_at };

  const closed = await db.query<{ ended_at: Date }>(
    `UPDATE learning_session SET ended_at = now()
      WHERE id = $1::uuid AND ended_at IS NULL
      RETURNING ended_at`,
    [sessionId],
  );
  if (closed.rows.length === 0) {
    // Ditutup bersamaan oleh permintaan lain — baca ulang keadaan final.
    const again = await db.query<{ ended_at: Date | null }>(
      `SELECT ended_at FROM learning_session WHERE id = $1::uuid`,
      [sessionId],
    );
    if (again.rows.length === 0 || again.rows[0].ended_at === null) return null;
    return { endedAt: again.rows[0].ended_at };
  }
  return { endedAt: closed.rows[0].ended_at };
}

/** Sesi milik anak tertentu (untuk cek kepemilikan sebelum dipakai). */
export async function sessionBelongsToChild(
  db: Db,
  sessionId: string,
  childId: string,
): Promise<boolean> {
  const row = await db.query<{ child_id: string; is_baseline: boolean }>(
    `SELECT child_id, COALESCE(started_at = ended_at, false) AS is_baseline
       FROM learning_session
      WHERE id = $1::uuid`,
    [sessionId],
  );
  if (row.rows.length === 0) return false;
  return row.rows[0].child_id === childId && row.rows[0].is_baseline === false;
}

/** Detail sesi untuk ditampilkan orang tua (VRD 10.2). */
export interface SessionDetail {
  sessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  /** `true` = sesi asesmen dasar (penanda `started_at = ended_at`). */
  isBaseline: boolean;
  /** Jumlah jawaban dalam sesi ini (hanya sesi belajar, bukan asesmen). */
  attemptCount: number;
  /** Durasi sesi belajar tertutup dalam ms; `null` bila belum ditutup/asesmen. */
  durationMs: number | null;
}

/** Ambil daftar sesi detail untuk satu anak, terbaru dulu. */
export async function getSessionDetails(
  db: Db,
  childId: string,
): Promise<SessionDetail[]> {
  const rows = await db.query<{
    id: string;
    started_at: Date;
    ended_at: Date | null;
    is_baseline: boolean;
    attempt_count: number | null;
    duration_ms: number | null;
  }>(
    `SELECT
       ls.id,
       ls.started_at,
       ls.ended_at,
       COALESCE(ls.started_at = ls.ended_at, false) AS is_baseline,
       (SELECT COUNT(*) FROM activity_attempt aa WHERE aa.session_id = ls.id) AS attempt_count,
       CASE
         WHEN ls.ended_at IS NOT NULL AND ls.ended_at <> ls.started_at
         THEN EXTRACT(EPOCH FROM (ls.ended_at - ls.started_at)) * 1000
         ELSE NULL
       END AS duration_ms
     FROM learning_session ls
    WHERE ls.child_id = $1::uuid
    ORDER BY ls.started_at DESC`,
    [childId],
  );
  return rows.rows.map((r) => ({
    sessionId: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    isBaseline: r.is_baseline,
    attemptCount: Number(r.attempt_count ?? 0),
    durationMs: r.duration_ms === null || r.duration_ms === undefined
      ? null
      : Math.round(Number(r.duration_ms)),
  }));
}
