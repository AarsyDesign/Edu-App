-- 0005_content_review_transitions.sql — Matriks transisi status konten
-- (VRD 11.11 / 11.13, menutup OPEN QUESTION 4 tentang aturan transisi).
--
-- PRD §7 menetapkan alur produksi:
--   DRAFT -> HUMAN_REVIEW -> QA_APPROVED -> PUBLISHED
--   pengecualian: PUBLISHED -> FLAGGED -> REVIEW -> UPDATED / UNPUBLISHED
--
-- Trigger BEFORE INSERT memastikan setiap baris content_review:
--   1. bergerak dari status yang MEMANG sedang dimiliki aktivitas
--      (from_status = activity.review_status), dan
--   2. menuju status yang sah menurut matriks di atas.
-- Karena sinkronisasi status aktivitas hanya terjadi lewat trigger AFTER INSERT
-- di migrasi 0001, langkah 1+2 membuat "terbit tanpa lulus QA" mustahil
-- dilakukan oleh kode mana pun (VRD 11.13: publish only from approved state).
--
-- Migrasi forward-only, satu transaksi, dicek checksum di schema_migrations.

CREATE OR REPLACE FUNCTION content_review_transition_valid() RETURNS trigger AS $$
DECLARE
  current_status content_review_status;
  allowed boolean;
BEGIN
  SELECT review_status INTO current_status
    FROM activity
   WHERE id = NEW.activity_id;

  -- FK activity_id menolak baris yatim pada pemeriksaan constraint berikutnya;
  -- di sini tidak ada yang bisa divalidasi.
  IF current_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.from_status <> current_status THEN
    RAISE EXCEPTION
      'content_review transition violates current status: activity is %, record says %',
      current_status, NEW.from_status
      USING ERRCODE = 'check_violation';
  END IF;

  allowed := (NEW.from_status, NEW.to_status) IN (
    ('DRAFT',       'HUMAN_REVIEW'),
    ('HUMAN_REVIEW', 'QA_APPROVED'),
    ('HUMAN_REVIEW', 'DRAFT'),
    ('QA_APPROVED',  'PUBLISHED'),
    ('PUBLISHED',    'FLAGGED'),
    ('PUBLISHED',    'UNPUBLISHED'),
    ('FLAGGED',      'HUMAN_REVIEW'),
    ('FLAGGED',      'UNPUBLISHED'),
    ('UNPUBLISHED',  'HUMAN_REVIEW')
  );

  IF NOT allowed THEN
    RAISE EXCEPTION
      'content_review transition violates allowed flow: % -> %',
      NEW.from_status, NEW.to_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_review_check_transition
  BEFORE INSERT ON content_review
  FOR EACH ROW EXECUTE FUNCTION content_review_transition_valid();
