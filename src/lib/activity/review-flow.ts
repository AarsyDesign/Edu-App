/**
 * Alur status review aktivitas (VRD 11.11).
 *
 * PRD §7 menetapkan produksi konten:
 *
 *   DRAFT -> HUMAN_REVIEW -> QA_APPROVED -> PUBLISHED
 *   pengecualian: PUBLISHED -> FLAGGED -> REVIEW -> UPDATED / UNPUBLISHED
 *
 * Modul ini adalah satu-satunya sumber kebenaran matriks transisi di sisi
 * aplikasi; aturan yang sama juga dijaga trigger di migrasi
 * `0005_content_review_transitions.sql`, sehingga jalur pintas melewati
 * persetujuan (VRD 11.13) tertutup baik di kode maupun di database.
 *
 * Setiap perpindahan status WAJIB menjadi baris `content_review`
 * (`from_status <> to_status`) — trigger `content_review_sync_status`
 * menyalinnya ke `activity.review_status`, jadi tidak ada jalur tulis status
 * yang meninggalkan jejak provenance.
 */
import type { Db } from "../db/index.ts";

export type ReviewStatus =
  | "DRAFT"
  | "HUMAN_REVIEW"
  | "QA_APPROVED"
  | "PUBLISHED"
  | "FLAGGED"
  | "UNPUBLISHED";

export type TransitionKind = "primary" | "secondary";

export interface ReviewTransition {
  to: ReviewStatus;
  /** Label tombol — bahasa Indonesia, tanpa istilah lulus/gagal/peringkat. */
  label: string;
  /**
   * `primary` = langkah maju dalam alur produksi (satu aksi high-emphasis
   * per layar, anti-slop), `secondary` = jalur mundur/tunda.
   */
  kind: TransitionKind;
}

/**
 * Transisi yang diizinkan, persis mengikuti PRD §7 — tidak ada yang lain.
 *
 * - `HUMAN_REVIEW -> DRAFT` = "request revision" (konten dikembalikan ke
 *   penulis, bukan dihapus).
 * - `PUBLISHED -> UNPUBLISHED` dan `FLAGGED -> UNPUBLISHED` = tarik dari
 *   tayang; `UNPUBLISHED/FLAGGED -> HUMAN_REVIEW` = masuk alur review lagi
 *   (sesudah diedit).
 * - `DRAFT -> PUBLISHED` sengaja TIDAK ada: penerbitan hanya dari
 *   `QA_APPROVED` (VRD 11.13).
 */
export const REVIEW_TRANSITIONS: Record<ReviewStatus, readonly ReviewTransition[]> = {
  DRAFT: [{ to: "HUMAN_REVIEW", label: "Kirim untuk review", kind: "primary" }],
  HUMAN_REVIEW: [
    { to: "QA_APPROVED", label: "Setujui (lulus QA)", kind: "primary" },
    { to: "DRAFT", label: "Minta revisi", kind: "secondary" },
  ],
  QA_APPROVED: [{ to: "PUBLISHED", label: "Terbitkan", kind: "primary" }],
  PUBLISHED: [
    { to: "FLAGGED", label: "Tandai masalah", kind: "secondary" },
    { to: "UNPUBLISHED", label: "Tarik dari tayang", kind: "secondary" },
  ],
  FLAGGED: [
    { to: "HUMAN_REVIEW", label: "Ajukan review ulang", kind: "primary" },
    { to: "UNPUBLISHED", label: "Tarik dari tayang", kind: "secondary" },
  ],
  UNPUBLISHED: [{ to: "HUMAN_REVIEW", label: "Ajukan review ulang", kind: "primary" }],
} as const;

export function isReviewStatus(value: string): value is ReviewStatus {
  return value in REVIEW_TRANSITIONS;
}

export function canTransition(from: string, to: string): boolean {
  if (!isReviewStatus(from) || !isReviewStatus(to)) return false;
  if (from === to) return false;
  return REVIEW_TRANSITIONS[from].some((t) => t.to === to);
}

export function allowedTransitions(from: string): readonly ReviewTransition[] {
  return isReviewStatus(from) ? REVIEW_TRANSITIONS[from] : [];
}

export const NOTES_MAX = 2000;

/** Validasi catatan transisi (opsional, mengikuti CHECK `content_review.notes`). */
export function parseReviewNotes(value: unknown): { ok: true; notes: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === "") return { ok: true, notes: null };
  if (typeof value !== "string") return { ok: false, message: "Catatan harus berupa teks." };
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, notes: null };
  if (trimmed.length > NOTES_MAX) {
    return { ok: false, message: `Catatan maksimal ${NOTES_MAX} karakter.` };
  }
  return { ok: true, notes: trimmed };
}

// ============================================================
// Riwayat review (append-only, PRD §7 provenance)
// ============================================================

export interface ReviewHistoryRow {
  id: string;
  fromStatus: string;
  toStatus: string;
  notes: string | null;
  reviewerName: string | null;
  createdAt: Date;
}

/**
 * Riwayat transisi satu aktivitas, terbaru dahulu. Nama reviewer diambil dari
 * `reviewer_account` (FK migrasi 0004) — akun reviewer terpisah dari akun
 * orang tua (PRD §13); bila akunnya terhapus, baris tetap tampil tanpa nama.
 */
export async function listReviewHistory(db: Db, activityId: string): Promise<ReviewHistoryRow[]> {
  const rows = await db.query<{
    id: string;
    from_status: string;
    to_status: string;
    notes: string | null;
    reviewer_name: string | null;
    created_at: Date;
  }>(
    `SELECT cr.id, cr.from_status, cr.to_status, cr.notes, cr.created_at,
            ra.display_name AS reviewer_name
       FROM content_review cr
       LEFT JOIN reviewer_account ra ON ra.id = cr.reviewer
      WHERE cr.activity_id = $1::uuid
      ORDER BY cr.created_at DESC, cr.id DESC`,
    [activityId],
  );

  return rows.rows.map((r) => ({
    id: r.id,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    notes: r.notes,
    reviewerName: r.reviewer_name,
    createdAt: r.created_at,
  }));
}
