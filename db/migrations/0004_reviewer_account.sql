-- 0004_reviewer_account.sql — Akun reviewer/konten (VRD Phase 11, item 11.1)
-- PRD §13: akun reviewer/contributor terpisah dari akun orang tua.
-- Hanya reviewer yang bisa mengelola konten (CRUD aktivitas, review, publish).
-- Migrasi ini forward-only, satu transaksi, dicek checksum di schema_migrations.

-- ============================================================
-- ENUM untuk peran reviewer
-- ============================================================
CREATE TYPE reviewer_role AS ENUM (
  'REVIEWER',
  'CONTENT_ADMIN'
);

-- ============================================================
-- reviewer_account (PRD §13: akun terpisah dari parent_account)
-- ============================================================
CREATE TABLE reviewer_account (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL
               CHECK (char_length(btrim(email)) BETWEEN 3 AND 254),
  display_name text NOT NULL
               CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  role         reviewer_role NOT NULL DEFAULT 'REVIEWER',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reviewer_account_email_unique
  ON reviewer_account (lower(btrim(email)));

CREATE TRIGGER reviewer_account_updated_at
  BEFORE UPDATE ON reviewer_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Kredensial reviewer (mirip parent_account: scrypt hash)
-- ============================================================
ALTER TABLE reviewer_account
  ADD COLUMN password_hash text;

-- ============================================================
-- Sesi reviewer (mirip parent_session, tabel terpisah)
-- ============================================================
CREATE TABLE reviewer_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id       uuid NOT NULL REFERENCES reviewer_account(id) ON DELETE CASCADE,
  token_hash        text NOT NULL,  -- SHA-256 dari token acak 32 byte
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  -- Tanpa IP/user-agent (minimisasi data, konsisten PRD §14)
  UNIQUE (reviewer_id, token_hash)
);

CREATE INDEX reviewer_session_reviewer_idx ON reviewer_session (reviewer_id);
CREATE INDEX reviewer_session_expires_idx ON reviewer_session (expires_at);

-- ============================================================
-- Perbaikan: tambah FK reviewer ke content_review (OPEN QUESTION #3)
-- ============================================================
-- content_review.reviewer sudah uuid, kini ditambah FK ke reviewer_account
ALTER TABLE content_review
  ADD CONSTRAINT content_review_reviewer_fk
  FOREIGN KEY (reviewer) REFERENCES reviewer_account(id)
  ON DELETE SET NULL;

-- activity.reviewed_by juga mengarah ke reviewer_account
ALTER TABLE activity
  ADD CONSTRAINT activity_reviewed_by_fk
  FOREIGN KEY (reviewed_by) REFERENCES reviewer_account(id)
  ON DELETE SET NULL;