# PRIVACY-AUDIT.md — Phase 15 Privacy & Child Safety Review

Tanggal: 2026-10-07 · Auditor: Mizan · Repo: `/opt/data/work/edu-app`

---

## 15.1 Inventory every child data field

Tabel `child_profile` (migrasi 0001, diperbarui 0002) — **hanya field ini**:

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `child_id` | uuid PK | System-generated |
| `parent_account_id` | uuid FK | Ownership anchor, NOT NULL, ON DELETE CASCADE |
| `nickname` | text | 1–40 char, trimmed, unique per parent (partial index aktif) |
| `age` | int | CHECK 3–7, parent-chosen (bukan DOB) |
| `avatar_key` | text nullable | Kunci non-living: `star`, `moon`, `book`, `lantern` (OQ 15) |
| `language` | text | Default `id`, pola `^[a-z]{2}(-[A-Z]{2})?$` |
| `learning_goals` | text[] | Max 6 items × 40 char, free-text (OQ 12) |
| `archived_at` | timestamptz nullable | Soft-delete marker (arsip, bukan hapus) |
| `created_at` | timestamptz | Server default |

**Tidak ada field PII berikut** (PRD §8, §14): nama lengkap, tanggal lahir, alamat, telepon, email, foto, lokasi GPS, ID sekolah, data medis, data biometrik.

Tabel terkait anak (hanya referensi `child_id`, tanpa data PII tambahan):
- `learning_session` — sesi belajar (termasuk baseline `started_at = ended_at`)
- `activity_attempt` — jawaban per aktivitas (ON DELETE RESTRICT ke `activity`)
- `learning_progress` — agregat per skill (attempts, correct, mastered_at nullable)
- `activity_option` — opsi aktivitas (bukan data anak, tapi FK ke activity)

---

## 15.2 Remove unnecessary fields

**Tidak ada field yang dihapus** — skema sudah minimal sejak Phase 2. Setiap field di atas memiliki alasan produk jelas (PRD §8, §12, §14). Tidak ada kolom "untuk masa depan" yang diam-diam ditambahkan.

---

## 15.3 Verify child data is not public

**Semua akses data anak melewati gerbang kepemilikan server-side** (`getChildForParent()`):

- Middleware `src/middleware.ts` melindungi prefiks `/parent`, `/api/parent`, `/api/children`, `/learn`, `/learn/**`, `/api/activity`, `/api/session`, `/api/assessment` (VRD 3.5, OQ 22).
- Handler **tidak pernah** membaca `parent_id`/`child_id` dari body/kueri klien — selalu dari `locals.parentSession` (VRD 3.8).
- `getChildForParent(db, childId, parentId)` menambahkan klausa `WHERE parent_account_id = $parentId AND archived_at IS NULL` (untuk alur belajar) / tanpa klausa arsip (untuk dashboard orang tua). Id bukan UUID → `null` tanpa query DB.
- Anti-enumerasi: profil milik orang lain, tidak ada, id rusak, dan terarsip (di alur belajar) → **hasil identik** (404/redirect dengan badan sama).
- Endpoint publisitas (child feed) hanya menyaring `review_status = 'PUBLISHED'` + usia anak — **tidak pernah** membaca data profil anak tanpa sesi parent.

**Verifikasi E2E**: `smoke-loop.mjs` membuktikan:
- `/learn` tanpa sesi → 303 `/login`
- `/api/children` tanpa sesi → 401
- Profil anak asing di dashboard → redirect `/parent` (bukan 404 yang membocorkan keberadaan)

---

## 15.4 Verify child profile cannot access community

**Tidak ada fitur komunitas/sosial** di codebase:
- Tidak ada chat, komentar, forum, leaderboard, sharing, undangan teman.
- Child mode (`/learn/**`) hanya menampilkan aktivitas PUBLISHED + renderer interaktif — tanpa tautan keluar, tanpa navigasi eksternal.
- Tidak ada endpoint yang mengembalikan daftar anak lain, aktivitas anak lain, atau data agregat lintas anak.

---

## 15.5 Verify parent gate on sensitive actions

| Aksi sensitif | Gerbang |
|---------------|---------|
| Buat/ubah/arsip profil anak | `POST/PATCH/DELETE /api/children` + `getChildForParent()` + CSRF Origin check |
| Ganti kata sandi / hapus akun parent | Belum ada (OQ 6) — tidak dibangun diam-diam |
| Ubah preferensi audio/durasi | Belum ada halaman (OQ 18) — tidak dibangun diam-diam |
| Terbitkan/tarik konten | Reviewer session guard + matriks transisi + trigger DB (VRD 11.11) |
| Impor batch draf AI | Reviewer session + rate limit `REVIEWER_WRITE` + validasi dua lapis (VRD 12.6) |

Semua endpoint sensitif: body ≤ 8 KB, CSRF via `Origin` header (403), `cache-control: no-store`, pesan galat aman `{error, message}`.

---

## 15.6 Verify external navigation gate

**Child mode (`/learn/**`)**: 
- Tidak ada tautan `<a href="...">` ke domain eksternal.
- Tidak ada `<iframe>`, `<script src="...">` eksternal.
- Semua navigasi internal (`/learn`, `/learn/area/:code`, `/learn/aktivitas/:id`).
- Offline banner hanya teks, tanpa tautan.

**Parent/Reviewer mode**: Tautan eksternal hanya ke dokumentasi (GitHub, DESIGN.md spec) — tidak ada di child mode.

---

## 15.7 Verify purchase gate

**Tidak ada pembelian/penagihan/IAP** di MVP. Kode tidak mengandung Stripe, Midtrans, Play Billing, App Store IAP, atau gateway pembayaran lain. PRD §19 melarang kompleksitas berlebih; VRD 15.7 diverifikasi: **tidak ada**.

---

## 15.8 Verify logs do not leak child PII

**Log aplikasi** (stdout/stderr server Astro):
- Middleware log: `[mw] 200 GET /parent/anak/…` — **tanpa UUID anak di log** (hanya path).
- Auth log: `[auth] login ok parent=uuid` — hanya `parent_account_id`, tidak ada data anak.
- Error log: stack trace tanpa query parameter / body sensitif.
- `activity_attempt` / `learning_progress` **tidak di-log** per baris.

**Database**: PGlite tidak menulis log query ke file (in-memory/embedded). File `.data/*/postgresql.conf` default `log_statement = 'none'`.

**Test**: `test/privacy-logs.test.ts` memindai output server saat smoke — tidak menemukan `child_id`, `nickname`, `age`, `avatar_key`, `learning_goals` di stdout.

---

## 15.9 Verify analytics are minimized

**Tidak ada analytics/tracking library** (Plausible, GA, PostHog, Mixpanel, dll.) di `package.json` maupun bundle client.
- Hanya metrik bawaan: `learning_session`, `activity_attempt`, `learning_progress` — **semua milik orang tua**, tersimpan di DB milik orang tua, tidak dikirim ke pihak ketiga.
- Tidak ada event `page_view`, `click`, `funnel`, `session_duration` ke endpoint telemetri.
- `navigator.sendBeacon`, `fetch` ke domain analytics — **tidak ada di codebase**.

---

## 15.10 Document retention/deletion behavior

### Arsip (soft-delete) — status saat ini
- `DELETE /api/children/:id` → set `archived_at = now()` (idempoten).
- Profil terarsip: **tersembunyi dari alur belajar anak** (`archived_at IS NULL` di query child home/area/aktivitas/asesmen), **tetap terbaca di dashboard orang tua** (`/parent/anak/:id` menampilkan catatan arsip).
- Riwayat belajar (`learning_session`, `activity_attempt`, `learning_progress`) **tidak dihapus** — FK `ON DELETE RESTRICT` mencegah hapus aktivitas yang punya attempt; arsip anak tidak cascade ke riwayat.

### Penghapusan permanen (hard delete) — **belum ada** (OQ 14)
- PRD §14 tidak menetapkan kebijakan retensi/hapus.
- Saat ini **tidak ada endpoint** hapus permanen anak + riwayat.
- Bila diperlukan: migrasi baru + endpoint `DELETE /api/children/:id/purge` (butuh konfirmasi Arsyad).

### Akun orang tua
- `DELETE /api/auth/account` **belum ada** (OQ 6).
- Jika dibuat: cascade → hapus `parent_session`, `child_profile` (→ arsip atau cascade tergantung kebijakan), `reviewer_account` terpisah (FK ke `reviewer_account` ON DELETE SET NULL di `content_review.reviewer`).

### Cadangan (backup)
- PGlite file di `.data/pglite/` — disalin manual atau via skrip backup (belum diotomatisasi, OQ 2 deployment).
- Migrasi SQL di `db/migrations/` — version-controlled, ikut ter-deploy.

---

## Ringkasan kepatuhan MVP

| Kriteria VRD 15 | Status | Bukti |
|-----------------|--------|-------|
| 15.1 Inventory | ✅ | Tabel di atas |
| 15.2 Minimasi | ✅ | Tidak ada field berlebih |
| 15.3 Non-publik | ✅ | Middleware + `getChildForParent` + smoke E2E |
| 15.4 Tanpa komunitas | ✅ | Kode tidak punya fitur sosial |
| 15.5 Parent gate | ✅ | Tabel gerbang di atas |
| 15.6 External nav gate | ✅ | Child mode bebas tautan keluar |
| 15.7 Purchase gate | ✅ | Tidak ada kode pembayaran |
| 15.8 Log bersih | ✅ | Tes `privacy-logs` + konfigurasi DB |
| 15.9 Analytics minimal | ✅ | Tidak ada library tracking |
| 15.10 Retensi terdokumentasi | ✅ | File ini |

---

## Open Questions terkait Phase 15

- **OQ 14**: Kebijakan retensi & penghapusan permanen — butuh keputusan Arsyad (arsip saja? purge setelah N hari? restore?).
- **OQ 6**: Lupa kata sandi / hapus akun parent — butuh provider email (tergantung OQ 2 deployment).
- **OQ 18**: Halaman preferensi audio/privasi — butuh keputusan produk (Phase 10/14).

---

*File ini dibuat untuk memenuhi VRD 15.10 "Document retention/deletion behavior" dan menutupi referensi `PRIVACY-AUDIT.md` di IMPLEMENTATION-AUDIT.md.*