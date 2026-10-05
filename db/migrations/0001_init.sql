-- 0001_init.sql — Skema inti aplikasi belajar anak (VRD Phase 2, item 2.1–2.13)
-- Mesin: PostgreSQL (kini PGlite embedded, tujuan akhir managed PostgreSQL — PRD §19).
-- Sumber kebutuhan: PRD §4 (learning area), §6 (tipe aktivitas), §7 (status konten &
-- sumber rujukan), §8 (onboarding), §10–11 (sesi & progres), §12–13 (akun orang tua,
-- pengaturan), SECURITY-PRIVACY (minimisasi data anak, constraint database, provenance).
-- Kaidah: forward-only. Satu file = satu transaksi. Jangan mengedit file yang sudah
-- diterapkan (dicek lewat checksum di schema_migrations) — buat 0002_xxx.sql baru.

-- ============================================================
-- ENUM (PRD §6, §7)
-- ============================================================

-- Alur produksi konten: DRAFT -> HUMAN_REVIEW -> QA_APPROVED -> PUBLISHED,
-- pengecualian: PUBLISHED -> FLAGGED -> REVIEW -> UNPUBLISHED (PRD §7).
CREATE TYPE content_review_status AS ENUM (
  'DRAFT',
  'HUMAN_REVIEW',
  'QA_APPROVED',
  'PUBLISHED',
  'FLAGGED',
  'UNPUBLISHED'
);

-- Enam tipe aktivitas MVP tambahan Simple True/False (PRD §6).
CREATE TYPE activity_type AS ENUM (
  'TAP_ANSWER',
  'COUNT_OBJECTS',
  'MATCH',
  'SORT',
  'SEQUENCE',
  'IDENTIFY_COLOR',
  'IDENTIFY_SHAPE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE'
);

-- Asal konten (PRD §7). COMMUNITY_CREATED ditandai future; VERIFIED adalah penanda
-- provenance review, bukan asal, sehingga tidak masuk enum ini.
CREATE TYPE content_origin AS ENUM (
  'HUMAN_CREATED',
  'AI_ASSISTED',
  'AI_DRAFT',
  'COMMUNITY_CREATED'
);

-- ============================================================
-- HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- parent_account (PRD §13: akun orang tua memiliki profil anak)
-- Tanpa kolom kredensial: penyimpanan kredensial diputuskan di Phase 3.
-- ============================================================

CREATE TABLE parent_account (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL
               CHECK (char_length(btrim(email)) BETWEEN 3 AND 254),
  display_name text NOT NULL
               CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Unik tanpa membedakan huruf besar/kecil dan spasi pinggir.
CREATE UNIQUE INDEX parent_account_email_unique
  ON parent_account (lower(btrim(email)));

CREATE TRIGGER parent_account_updated_at
  BEFORE UPDATE ON parent_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- child_profile (PRD §8 onboarding, §14 privasi)
-- Sengaja TIDAK ada: nama lengkap, tanggal lahir, alamat, nomor telepon, lokasi.
-- Usia disimpan sebagai usia yang dipilih orang tua (PRD §8 butir 4), bukan DOB.
-- ============================================================

CREATE TABLE child_profile (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_account_id uuid NOT NULL
                    REFERENCES parent_account(id) ON DELETE CASCADE,
  nickname          text NOT NULL
                    CHECK (char_length(btrim(nickname)) BETWEEN 1 AND 40),
  age               smallint NOT NULL CHECK (age BETWEEN 3 AND 7),
  avatar_key        text CHECK (avatar_key IS NULL
                    OR char_length(avatar_key) BETWEEN 1 AND 40),
  language          text NOT NULL DEFAULT 'id'
                    CHECK (language ~ '^[a-z]{2}(-[A-Za-z0-9]{2,8})?$'),
  learning_goals    text[] NOT NULL DEFAULT '{}',
  archived_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX child_profile_parent_account_idx
  ON child_profile (parent_account_id);

-- Anak aktif unik per akun (nama kembar boleh lagi setelah arsip).
CREATE UNIQUE INDEX child_profile_nickname_active_unique
  ON child_profile (parent_account_id, lower(btrim(nickname)))
  WHERE archived_at IS NULL;

CREATE TRIGGER child_profile_updated_at
  BEFORE UPDATE ON child_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- learning_area (PRD §4: enam mata pelajaran MVP)
-- ============================================================

CREATE TABLE learning_area (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]+$'),
  title       text NOT NULL
              CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  sort_order  smallint NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER learning_area_updated_at
  BEFORE UPDATE ON learning_area
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- skill (VRD 2.7 rentang usia, 2.8 tingkat kesukaran)
-- difficulty: 1 = paling mudah .. 3 = paling menantang (skala netral,
-- label per level menyusul bersama konten, VRD 5.4).
-- ============================================================

CREATE TABLE skill (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_area_id  uuid NOT NULL REFERENCES learning_area(id) ON DELETE RESTRICT,
  code              text NOT NULL CHECK (code ~ '^[a-z0-9_]+$'),
  title             text NOT NULL
                    CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description       text CHECK (description IS NULL
                    OR char_length(description) <= 1000),
  age_min           smallint NOT NULL DEFAULT 3 CHECK (age_min BETWEEN 3 AND 7),
  age_max           smallint NOT NULL DEFAULT 7 CHECK (age_max BETWEEN 3 AND 7),
  difficulty        smallint NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  sort_order        smallint NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_age_range_valid CHECK (age_min <= age_max),
  CONSTRAINT skill_area_code_unique UNIQUE (learning_area_id, code),
  -- Dibutuhkan agar activity bisa memakai FK komposit (skill_id, learning_area_id).
  CONSTRAINT skill_id_area_unique UNIQUE (id, learning_area_id)
);

CREATE INDEX skill_learning_area_idx ON skill (learning_area_id);
CREATE INDEX skill_age_range_idx ON skill (age_min, age_max);
CREATE INDEX skill_difficulty_idx ON skill (difficulty);

CREATE TRIGGER skill_updated_at
  BEFORE UPDATE ON skill
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- activity (PRD §6 field wajib aktivitas)
-- ============================================================

CREATE TABLE activity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id          uuid NOT NULL,
  learning_area_id  uuid NOT NULL,
  target_age_min    smallint NOT NULL DEFAULT 3
                    CHECK (target_age_min BETWEEN 3 AND 7),
  target_age_max    smallint NOT NULL DEFAULT 7
                    CHECK (target_age_max BETWEEN 3 AND 7),
  difficulty        smallint NOT NULL DEFAULT 1
                    CHECK (difficulty BETWEEN 1 AND 3),
  prompt            text NOT NULL
                    CHECK (char_length(btrim(prompt)) BETWEEN 1 AND 500),
  interaction_type  activity_type NOT NULL,
  -- Jawaban benar berbentuk data (angka/teks/struktur); untuk tipe berbasis
  -- pilihan, kebenaran ditandai di activity_option.is_correct.
  correct_answer    jsonb,
  -- Umpan balik langsung untuk anak (PRD §10).
  explanation       text CHECK (explanation IS NULL
                    OR char_length(explanation) <= 1000),
  content_origin    content_origin NOT NULL DEFAULT 'HUMAN_CREATED',
  review_status     content_review_status NOT NULL DEFAULT 'DRAFT',
  -- Provinsi review (PRD §6 "reviewer"): akun reviewer terpisah dari akun orang
  -- tua (PRD §13) dan belum ada tabelnya — lihat OPEN QUESTION di audit.
  reviewed_by       uuid,
  reviewed_at       timestamptz,
  version           smallint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_age_range_valid
    CHECK (target_age_min <= target_age_max),
  -- learning_area_id wajib konsisten dengan skill yang dituju.
  CONSTRAINT activity_skill_fk FOREIGN KEY (skill_id, learning_area_id)
    REFERENCES skill(id, learning_area_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX activity_skill_idx ON activity (skill_id);
CREATE INDEX activity_learning_area_idx ON activity (learning_area_id);
CREATE INDEX activity_age_range_idx ON activity (target_age_min, target_age_max);
CREATE INDEX activity_review_status_idx ON activity (review_status);
CREATE INDEX activity_origin_idx ON activity (content_origin);

CREATE TRIGGER activity_updated_at
  BEFORE UPDATE ON activity
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- activity_option (PRD §6 "options/data")
-- ============================================================

CREATE TABLE activity_option (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position >= 0),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_correct   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_option_position_unique UNIQUE (activity_id, position)
);

-- ============================================================
-- learning_session (PRD §10 target sesi 5–15 menit)
-- ============================================================

CREATE TABLE learning_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  CONSTRAINT learning_session_window CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX learning_session_child_idx
  ON learning_session (child_id, started_at DESC);

-- ============================================================
-- activity_attempt (PRD §10: jawaban + feedback langsung, retry diizinkan)
-- ============================================================

CREATE TABLE activity_attempt (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
  -- NULL sah: asesmen dasar (Phase 8) boleh berdiri tanpa sesi belajar.
  session_id   uuid REFERENCES learning_session(id) ON DELETE SET NULL,
  -- RESTRICT: riwayat anak tidak ikut hilang bila konten dihapus; jalur wajar
  -- adalah UNPUBLISHED (PRD §7), bukan hard delete.
  activity_id  uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
  attempt_no   smallint NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  answer       jsonb NOT NULL,
  -- NULL = belum dinilai; boolean = hasil penilaian (PRD §10).
  is_correct   boolean,
  hint_used    boolean NOT NULL DEFAULT false,
  duration_ms  integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_attempt_child_idx ON activity_attempt (child_id, created_at DESC);
CREATE INDEX activity_attempt_activity_idx ON activity_attempt (activity_id);
CREATE INDEX activity_attempt_session_idx ON activity_attempt (session_id);

-- ============================================================
-- learning_progress (VRD 9: progres per anak per skill)
-- ============================================================

CREATE TABLE learning_progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES child_profile(id) ON DELETE CASCADE,
  skill_id          uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,
  attempts_count    integer NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
  correct_count     integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  last_practiced_at timestamptz,
  mastered_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_progress_count_valid CHECK (correct_count <= attempts_count),
  CONSTRAINT learning_progress_child_skill_unique UNIQUE (child_id, skill_id)
);

CREATE INDEX learning_progress_child_idx ON learning_progress (child_id);
CREATE INDEX learning_progress_skill_idx ON learning_progress (skill_id);

CREATE TRIGGER learning_progress_updated_at
  BEFORE UPDATE ON learning_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- content_review (PRD §7: konten AI tidak boleh publish tanpa review)
-- Menyimpan setiap perpindahan status sebagai jejak provenance.
-- ============================================================

CREATE TABLE content_review (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  from_status  content_review_status NOT NULL,
  to_status    content_review_status NOT NULL,
  notes        text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  -- Akun reviewer: sama dengan activity.reviewed_by (lihat OPEN QUESTION).
  reviewer     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_review_transition_valid CHECK (from_status <> to_status)
);

CREATE INDEX content_review_activity_idx
  ON content_review (activity_id, created_at DESC);
CREATE INDEX content_review_status_idx ON content_review (to_status);

-- Sinkronisasi status aktivitas dari jejak review: perubahan status resmi tercatat
-- sebagai event review, sehingga alur DRAFT -> ... -> PUBLISHED tidak bisa dilewati
-- diam-diam oleh konten AI (SECURITY-PRIVACY: content approval workflow).
CREATE OR REPLACE FUNCTION sync_activity_review_status() RETURNS trigger AS $$
BEGIN
  UPDATE activity
     SET review_status = NEW.to_status,
         reviewed_by   = COALESCE(NEW.reviewer, reviewed_by),
         reviewed_at   = NEW.created_at
   WHERE id = NEW.activity_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_review_sync_status
  AFTER INSERT ON content_review
  FOR EACH ROW EXECUTE FUNCTION sync_activity_review_status();

-- ============================================================
-- content_source (PRD §7: rujukan wajib untuk klaim faktual/keagamaan)
-- ============================================================

CREATE TABLE content_source (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id       uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  title             text NOT NULL
                    CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  source_type       text NOT NULL
                    CHECK (char_length(btrim(source_type)) BETWEEN 1 AND 60),
  reference_detail  text NOT NULL
                    CHECK (char_length(btrim(reference_detail)) BETWEEN 1 AND 2000),
  methodology       text CHECK (methodology IS NULL
                    OR char_length(methodology) <= 2000),
  -- PRD §7: perbedaan pendapat tidak boleh disajikan sebagai mutlak.
  is_disputed       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_source_activity_idx ON content_source (activity_id);

-- ============================================================
-- app_setting (PRD §12: preferensi mode orang tua — audio, durasi sesi)
-- Lingkup per akun orang tua; default global hidup di kode, bukan di database.
-- ============================================================

CREATE TABLE app_setting (
  parent_account_id uuid NOT NULL REFERENCES parent_account(id) ON DELETE CASCADE,
  key               text NOT NULL CHECK (key ~ '^[a-z0-9_.]+$'),
  value             jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_setting_pkey PRIMARY KEY (parent_account_id, key)
);

CREATE TRIGGER app_setting_updated_at
  BEFORE UPDATE ON app_setting
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
