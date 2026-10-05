-- 0002_parent_auth.sql — Kredensial & sesi orang tua (VRD Phase 3, item 3.1–3.4)
-- Sumber kebutuhan: VRD Phase 3 (registrasi, login, logout, kedaluwarsa sesi),
-- PRD §13 (parent = account owner), §14 (secure authentication, server-side
-- authorization), SECURITY-PRIVACY (secure session management, secrets never in
-- client bundle).
-- Kaidah: forward-only. Satu file = satu transaksi. Jangan mengedit file yang
-- sudah diterapkan (dicek lewat checksum di schema_migrations) — buat
-- 0003_xxx.sql baru.

-- ============================================================
-- Kredensial orang tua
-- Ditambahkan ke parent_account (0001 sengaja tanpa kolom ini: cara
-- autentikasi belum diputuskan saat Phase 2 — lihat audit keputusan 9).
-- ============================================================

-- Hash modular "algo$N$r$p$salt$hash" (kini scrypt). Kata sandi TIDAK PERNAH
-- disimpan maupun dikirim balik ke klien.
ALTER TABLE parent_account
  ADD COLUMN password_hash text NOT NULL
  CHECK (char_length(password_hash) BETWEEN 20 AND 300);

-- ============================================================
-- parent_session — sesi login orang tua (VRD 3.4 kedaluwarsa, 3.3 logout)
-- Yang disimpan hanya SHA-256 dari token acak; token mentah hanya hidup di
-- cookie HttpOnly klien, sehingga kebocoran database ≠ kebocoran sesi.
-- Tidak ada IP / user-agent / perangkat: minimisasi data (PRD §14).
-- ============================================================

CREATE TABLE parent_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_account_id uuid NOT NULL
                    REFERENCES parent_account(id) ON DELETE CASCADE,
  -- hex sha256 -> tepat 64 karakter
  token_hash        text NOT NULL UNIQUE
                    CHECK (char_length(token_hash) = 64),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_session_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX parent_session_parent_idx ON parent_session (parent_account_id);
CREATE INDEX parent_session_expires_idx ON parent_session (expires_at);

CREATE TRIGGER parent_session_updated_at
  BEFORE UPDATE ON parent_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
