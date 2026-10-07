# Phase 15 — Privacy and Child Safety Review (VRD 15.1–15.10)

**Tanggal:** 2026-10-07  
**Auditor:** Mizan (cron run)  
**Status:** ✅ DONE — semua item diverifikasi, tidak ada temuan kritis

---

## 15.1 Inventory setiap field data anak

| Tabel | Kolom | PII? | Keterangan |
|-------|-------|------|------------|
| `child_profile` | `id` | Tidak | UUID internal |
| | `parent_account_id` | Tidak | FK ke akun orang tua |
| | `nickname` | **Ya (minimal)** | Nama panggilan, 1–40 char, dipilih orang tua |
| | `age` | **Ya (minimal)** | Usia 3–7, dipilih orang tua (bukan DOB) |
| | `avatar_key` | Tidak | Kunci avatar non-hidup (opsional) |
| | `language` | Tidak | Kode bahasa (default `id`) |
| | `learning_goals` | **Ya (minimal)** | Array teks bebas maks 6 butir × 40 char, isian orang tua |
| | `archived_at` | Tidak | Timestamp arsip |
| | `created_at`, `updated_at` | Tidak | Audit trail |
| `learning_session` | `id`, `child_id`, `started_at`, `ended_at` | Tidak | Sesi belajar |
| `activity_attempt` | `id`, `child_id`, `session_id`, `activity_id`, `attempt_no`, `answer`, `is_correct`, `hint_used`, `duration_ms`, `created_at` | Tidak | Jawaban & hasil penilaian (bukan identitas) |
| `learning_progress` | `id`, `child_id`, `skill_id`, `attempts_count`, `correct_count`, `last_practiced_at`, `mastered_at`, `created_at`, `updated_at` | Tidak | Agregasi progres per skill |

**Kesimpulan:** Tidak ada field PII berlebih — tidak ada nama lengkap, DOB, alamat, telepon, lokasi, foto, sekolah, media sosial (sesuai PRD §8 & SECURITY-PRIVACY prinsip 1, 4).

---

## 15.2 Hapus field tidak perlu

**Tidak ada field yang perlu dihapus.** Semua kolom di atas mendukung fungsionalitas MVP:
- `nickname`, `age`, `language` → onboarding (PRD §8)
- `avatar_key`, `learning_goals` → opsional, PRD §8
- `archived_at` → retensi (PRD §14)
- Tabel transaksional (`learning_session`, `activity_attempt`, `learning_progress`) → loop belajar + progress (PRD §10–11, VRD 7, 9)

---

## 15.3 Verifikasi data anak tidak publik

| Jalur baca | Terlindungi? | Bukti |
|------------|--------------|-------|
| `/learn` (child home) | ✅ | Middleware `isProtectedPath("/learn")` → `guardRequest()` butuh sesi parent |
| `/learn/area/:code` | ✅ | Sama di atas + `getChildForParent()` validasi kepemilikan |
| `/learn/aktivitas/:id` | ✅ | Sama di atas + `getPublishedActivityById` + filter usia |
| `GET /api/activity/attempt` | N/A (write-only) | POST only |
| `GET /api/session/start` | ✅ | Middleware + `getChildForParent` |
| `GET /api/assessment/baseline` | ✅ | Middleware + `getChildForParent` |
| `GET /api/parent/progress` | ✅ | Middleware + `getChildForParent` |
| `GET /api/children` | ✅ | Middleware + `getChildForParent` |
| `GET /api/learning-areas` | ✅ | Middleware (bukan data anak) |
| **Query DB langsung** | ✅ | Semua lewat `getChildForParent()` yang selalu menambah `parent_account_id = $parentId` |

**Tidak ada endpoint publik yang mengembalikan data anak.** Semua membutuhkan sesi orang tua yang divalidasi ke database.

---

## 15.4 Verifikasi profil anak tidak bisa akses komunitas

| Fitur komunitas | Status MVP | Verifikasi |
|-----------------|------------|------------|
| Profil publik anak | ❌ Non-Goal (PRD §20) | Tidak ada rute `/child/:id` publik |
| Chat anak-ke-anak | ❌ Non-Goal (PRD §20) | Tidak ada tabel/chat endpoint |
| Komentar komunitas | ❌ Non-Goal (PRD §20) | Tidak ada |
| Link eksternal tanpa parent gate | ❌ Non-Goal (PRD §13) | Child mode tidak punya link eksternal sama sekali |
| Pembelian tanpa parent gate | ❌ Non-Goal (PRD §20) | Tidak ada payment gateway |

**Kesimpulan:** Child mode (`/learn/**`) sepenuhnya terisolasi — hanya aktivitas belajar, tanpa lapisan sosial.

---

## 15.5 Verifikasi parent gate pada aksi sensitif

| Aksi sensitif | Parent gate | Implementasi |
|---------------|-------------|--------------|
| Buat profil anak | ✅ | `/parent/profil/baru` butuh sesi parent (middleware) |
| Ubah profil anak | ✅ | `/parent/profil/:id/edit` + `getChildForParent()` |
| Arsipkan profil anak | ✅ | Form `DELETE` + konfirmasi `window.confirm` + `fetch DELETE` ke endpoint terlindungi |
| Hapus aktivitas (reviewer) | ✅ | Hanya reviewer terautentikasi, endpoint `DELETE /api/reviewer/aktivitas/:id` |
| Ubah status konten | ✅ | Hanya reviewer, matriks transisi PRD §7 dijaga DB trigger |
| Logout | ✅ | `POST /api/auth/logout` + `revokeSession` |

**Semua aksi sensitif memerlukan sesi parent/reviewer yang divalidasi server-side.** Tidak ada aksi sensitif yang bisa dilakukan tanpa autentikasi.

---

## 15.6 Verifikasi external navigation gate

Child mode (`/learn/**`):
- Tidak ada link eksternal sama sekali
- Navigasi hanya ke: `/learn`, `/learn/area/:code`, `/learn/aktivitas/:id`, `/parent` (kembali ke dashboard orang tua)
- Tombol "Kembali ke Area Orang Tua" → `/parent` (masih dalam domain, butuh sesi)

Parent mode (`/parent/**`):
- Link ke reviewer `/reviewer/login` (domain terpisah, butuh akun reviewer beda)
- Tidak ada link eksternal ke pihak ketiga

Reviewer mode (`/reviewer/**`):
- Link pratinjau ke `/reviewer/aktivitas/:id/pratinjau` (internal)
- Tidak ada link eksternal

**Kesimpulan:** Tidak ada navigasi eksternal dari child mode. Parent gate terpenuhi karena child mode tidak punya link keluar.

---

## 15.7 Verifikasi purchase gate

**MVP tidak memiliki payment gateway** (PRD §20 Non-Goals). Tidak ada fitur pembelian, subscription, atau in-app purchase. Item ini N/A untuk MVP.

---

## 15.8 Verifikasi log tidak bocorkan PII anak

| Sumber log | Isi | PII anak? |
|------------|-----|-----------|
| `console.log/error/warn` di kode aplikasi | **Tidak ada** (0 hasil `grep`) | N/A |
| Database query logging (PGlite) | Default PGlite tidak log query | N/A |
| Middleware/guard | Hanya log struktur error aman (kode + pesan generik) | Tidak |
| Smoke test script | Hanya log status HTTP + ID sesi (UUID) | Tidak (UUID bukan PII) |

**Kesimpulan:** Tidak ada logging PII anak di kode. UUID sesi/profil bukan PII.

---

## 15.9 Verifikasi analytics diminimalkan

| Analytics/Tracking | Status |
|--------------------|--------|
| Google Analytics / GA4 | ❌ Tidak ada |
| Mixpanel / Amplitude / PostHog | ❌ Tidak ada |
| Custom event tracking | ❌ Tidak ada (0 hasil `grep analytics\|tracking\|telemetry`) |
| Error monitoring (Sentry dll) | ❌ Tidak ada |
| Server access log | Hanya standar Astro/Node (IP, path, status) — tidak ada field anak |

**Kesimpulan:** Analytics diminimalkan — tidak ada tracking perilaku anak. Hanya log akses server standar.

---

## 15.10 Dokumentasi retensi & penghapusan

| Data | Retensi | Penghapusan |
|------|---------|-------------|
| `parent_account` | Selama akun aktif | `DELETE` via endpoint belum ada (OQ 14) — saat ini hanya `revokeAllSessions` |
| `parent_session` | 14 hari default (`SESSION_TTL_DAYS`), auto-purge `purgeExpiredSessions()` | Otomatis lewat cron/job |
| `child_profile` | Selama tidak diarsipkan | **Arsip (soft delete)** via `archived_at` — riwayat belajar **tidak dihapus** (PRD §14, VRD 4.10) |
| `child_profile` (terarsip) | Tak terbatas (belum ada kebijakan) | Belum ada hard delete / restore (OQ 14) |
| `learning_session`, `activity_attempt`, `learning_progress` | Selamanya (append-only, `ON DELETE RESTRICT` ke `activity`) | Tidak dihapus — bagian dari jejak belajar anak |
| `activity`, `activity_option`, `skill`, `learning_area` | Selamanya (konten terpusat) | `UNPUBLISHED` status, bukan hapus |
| `content_review`, `content_source` | Selamanya (provenance) | Append-only, tidak diedit |
| `reviewer_account`, `reviewer_session` | Selama akun aktif | Mirip parent, TTL sesi 14 hari |

**Catatan:** PRD §14 meminta "configurable retention/deletion strategy" tetapi tidak menspesifikasikan nilainya. Implementasi saat ini: **arsip saja, tanpa hard delete**, riwayat belajar dihormati. Hard delete & restore perlu keputusan produk (OQ 14).

---

## Ringkasan Temuan

| Item | Status | Catatan |
|------|--------|---------|
| 15.1 Inventory field data anak | ✅ Lolos | Hanya field minimal PRD §8 |
| 15.2 Hapus field tidak perlu | ✅ Lolos | Tidak ada field berlebih |
| 15.3 Data anak tidak publik | ✅ Lolos | Semua butuh sesi parent + kepemilikan |
| 15.4 Profil anak tidak akses komunitas | ✅ Lolos | Child mode sepenuhnya terisolasi |
| 15.5 Parent gate aksi sensitif | ✅ Lolos | Semua butuh sesi tervalidasi |
| 15.6 External navigation gate | ✅ Lolos | Child mode tidak punya link keluar |
| 15.7 Purchase gate | ✅ N/A | MVP tidak punya payment |
| 15.8 Log tidak bocorkan PII anak | ✅ Lolos | Tidak ada logging PII |
| 15.9 Analytics diminimalkan | ✅ Lolos | Tidak ada tracking anak |
| 15.10 Retensi & penghapusan | ✅ Terisi | Arsip soft-delete, OQ 14 terbuka |

---

## Keputusan untuk Run Berikutnya

- **Phase 15: ✅ DONE** — audit selesai, tanpa temuan yang mengharuskan perubahan kode.
- **Langkah berikutnya:** Phase 16 (Quality Assurance) — VRD 16.1–16.18 unit/integration test coverage, tapi **test suite sudah 258 passed** dan smoke E2E hijau. Phase 16 sebagian besar terpenuhi lewat praktik test-driven selama Phase 0–15.
- **Open Questions yang masih terbuka** (dari IMPLEMENTATION-AUDIT.md):
  - OQ 14: Retensi & penghapusan permanen (perlu keputusan Arsyad)
  - OQ 16/17: UI onboarding baseline (tertahan sampai Phase 13 konten)
  - OQ 18/5: Preferensi audio per anak + halaman pengaturan (butuh keputusan produk)
  - OQ 23: Bukti ambang mastery / rekomendasi (butuh data Phase 13)
  - OQ 24: Konten PUBLISHED boleh diedit langsung? (saat ini dikunci)
  - OQ 25: Bentuk field source (single vs multi-barisan)
  - OQ 26: Provider/model AI untuk generate batch draf (impor sudah siap)
- **Phase 13 (Seed 100 Activities)** siap dimulai kapanpun Arsyad siap review — endpoint impor batch draf AI (`POST /api/reviewer/aktivitas/import`) sudah operasional.