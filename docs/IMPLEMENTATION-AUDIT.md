# IMPLEMENTATION-AUDIT.md — Phase 0 (Repository & Environment Audit)

Tanggal: 2026-10-04 · Auditor: Mizan · Repo: `/opt/data/work/edu-app`

## 0.1–0.3 Kondisi repository

| Item | Temuan |
|------|--------|
| Status repo | **BARU** — `git init -b main` dilakukan 2026-10-04, **belum ada commit** |
| Isi repo | Hanya `docs/` (7 file handoff dari Arsyad) |
| Framework/runtime | **BELUM ADA** — belum ada `package.json`, source code, atau konfigurasi |
| Package manager | **BELUM ADA** (kandidat: npm/pnpm — mengikuti keputusan stack) |
| Script lint/test/build | **BELUM ADA** |
| Konvensi env variable | **BELUM ADA** (akan didefinisikan di Phase 1) |
| Database | **BELUM ADA** (PRD §19: managed PostgreSQL, single deployable) |
| Deployment target | **BELUM DIPUTUSKAN** (PRD §19: hindari microservices/K8s/Redis/queue) |
| Auth | **BELUM ADA** (VRD Phase 3) |
| Design system | **DOKUMEN LENGKAP** — `docs/DESIGN-SYSTEM.md` (palette, tipografi, motion, anti-slop) |

## 0.11 Dokumen handoff tersedia

| File | Isi | Status |
|------|-----|--------|
| `docs/PRD.md` | Kebutuhan produk, 23 section, MVP 100 aktivitas | Lengkap (v0.1) |
| `docs/VRD.md` | Roadmap atomik Phase 0–20 | Lengkap (v0.1) |
| `docs/DESIGN-SYSTEM.md` | Sistem visual "Calm Islamic Kids Learning UI" | Lengkap |
| `docs/CONTENT-SPEC.md` | Rencana 100 aktivitas per learning area | Lengkap |
| `docs/SECURITY-PRIVACY.md` | Prinsip + threat model + kontrol wajib | Lengkap |
| `docs/QA-ACCEPTANCE.md` | Journey kritis + regression checklist | Lengkap |
| `docs/README.md` | Urutan eksekusi 14 langkah | Lengkap |

## 0.12 Konflik / keputusan yang harus diambil sebelum Phase 1

**Tidak ada konflik antar dokumen.** Yang ada adalah **keputusan arsitektur yang belum dibuat** (karena repo kosong):

1. **Stack runtime** — PRD §19 bersifat *implementation-flexible*: "PWA/Web is a viable first client". Belum ada framework yang dipilih. Kandidat sesuai PRD:
   - Next.js (App Router) + PostgreSQL/Prisma — satu deployable, sesuai kebiasaan Arsyad (natasekolah)
   - Alternatif lain: SvelteKit/Astro+API — tetap single deployable
2. **Database** — PRD: managed PostgreSQL; belum ada konfigurasi/koneksi.
3. **Deployment target** — belum ditentukan (Vercel? VPS? — PRD melarang kompleksitas berlebih).
4. **Test runner** — belum ditentukan (PRD mewajibkan test tiap milestone).

## 0.13 Critical architecture blocker?

**TIDAK ADA blocker kritis.** Repo kosong justru bersih: tidak ada infrastruktur lama yang harus dipertahankan (VRD 0.10 tidak berlaku karena tidak ada yang ada).

Satu-satunya **hambatan keputusan** (bukan blocker teknis): pemilihan stack harus dikonfirmasi pemilik produk **sebelum Phase 1**, karena seluruh Phase 2+ bergantung padanya.

## Kesimpulan Phase 0

- ✅ Repository dipahami (baru, kosong, `main`)
- ✅ Konvensi yang ada didokumentasikan (hanya dokumen handoff)
- ✅ Tidak ada perubahan destruktif (tidak ada yang bisa dihancurkan)
- ⏸ **STOP sesuai VRD 0.13** — menunggu keputusan stack dari Arsyad sebelum Phase 1 (Product Foundation).

## Status Fase (VRD) — diperbarui tiap run cron

| Phase | Judul | Status | Terakhir |
|-------|-------|--------|----------|
| 0 | Repository and Environment Audit | ✅ DONE | 2026-10-04 (commit `cbe7564`) |
| 1 | Product Foundation | ✅ DONE | 2026-10-04 (commit `eaff019`) — tokens, shell, error page, empty state, 4 test; spec token + gerbang lint anti-slop `c18723b` |
| 2 | Data Model | ✅ DONE | 2026-10-05 (commit `3e4a0e3`) — 12 tabel, migrasi + checksum, 20 test |
| 3–19 | sisa VRD | ⬜ BELUM | — |
| 20 | Post-MVP | 🔒 gate by evidence | dilarang otomatis |

## Keputusan desain Phase 2 (VRD 2.1–2.15)

1. **Mesin database**: PGlite 0.5.8 (PostgreSQL 18 embedded, WASM) lewat lapisan
   tunggal `src/lib/db/` — mesin lokal tidak punya server PostgreSQL. File SQL
   migrasi dibuat standar PostgreSQL agar bisa langsung dipakai managed
   PostgreSQL (PRD §19) tanpa mengubah kode lain.
2. **Migrasi forward-only**: `db/migrations/*.sql`, urut nama, satu file =
   satu transaksi, dicatat di `schema_migrations` (id + checksum SHA-256).
   File yang sudah diterapkan tidak boleh diedit — perubahan = file baru.
   Skrip `down` tidak disediakan; pemulihan = backup atau DB bersih + terapkan
   ulang (VRD 2.15, diuji test: migrasi gagal tidak meninggalkan apa pun).
3. **Minimisasi PII**: `child_profile` hanya punya nickname, usia (3–7, pilihan
   orang tua — bukan tanggal lahir), avatar non-hidup, bahasa, learning goals.
   Tanpa nama lengkap/tgl lahir/alamat/telepon/lokasi (PRD §8, §14). Test
   memastikan daftar kolomnya persis.
4. **Usia & kesukaran**: `age`/`target_age_min`/`target_age_max` CHECK 3–7
   (`min <= max`); `difficulty` integer 1–3 (label per level menyusul bersama
   konten, VRD 5.4 — belum ada di PRD sehingga tidak dikarang).
5. **Kepemilikan**: FK `child_profile.parent_account_id NOT NULL ON DELETE
   CASCADE`; delete akun orang tua menghapus seluruh jejak anak (retensi).
   Tidak ada view publik; semua akses anak harus melewati join ke akun orang tua
   → dasar cek otorisasi server-side Phase 3.
6. **Provenance konten**: `content_review` menyimpan tiap transisi status; trigger
   menyalinnya ke `activity.review_status` sehingga alur DRAFT → … → PUBLISHED
   tidak bisa dilewati diam-diam. `content_source` memaksa rujukan (title, type,
   reference detail) + flag `is_disputed` untuk klaim keagamaan (PRD §7).
7. **Riwayat tak boleh hilang/diedit**: `activity_attempt` → `ON DELETE RESTRICT`
   terhadap aktivitas (jalur wajar = UNPUBLISHED); tabel riwayat/jejak
   (`learning_session`, `activity_attempt`, `activity_option`, `content_review`,
   `content_source`) append-only tanpa `updated_at`.
8. **`app_setting` berlingkup per akun orang tua** (PRD §12: preferensi audio &
   durasi sesi); default global hidup di kode, bukan database.
9. **Kredensial orang tua belum ada di skema** — cara autentikasi belum disebut
   PRD. Kolomnya ditambahkan lewat migrasi `0002` di Phase 3.

## OPEN QUESTION
1. ~~Database: mesin lokal tidak punya PostgreSQL~~ → **SELESAI 2026-10-05**:
   PGlite dipakai lewat `src/lib/db/` (keputusan 1 di atas). Bila Arsyad
   prefer managed PostgreSQL lebih awal, cukup ganti isi modul itu.
2. Deployment target belum diputuskan (PRD §19 tidak menyebut platform).
   Terkait: folder `db/migrations/` dibaca dari disk saat aplikasi start —
   pastikan ikut ter-deploy, atau set env `MIGRATIONS_DIR`.
3. **Identitas reviewer konten**: `activity.reviewed_by` dan
   `content_review.reviewer` berupa `uuid` tanpa FK karena akun reviewer harus
   terpisah dari akun orang tua (PRD §13) dan tabelnya belum ada. Putuskan di
   Phase 11 (Content Management) lalu tambahkan FK lewat migrasi baru.
4. **Matriks transisi status konten**: PRD §7 menyebut alur produksi tapi tidak
   memberi daftar transisi eksplisit. Skema kini hanya memvalidasi `from ≠ to`
   + enum. Aturan transisi yang sah diputuskan di Phase 11, bukan dikarang di
   sini.
5. **Lingkup preferensi per anak**: `app_setting` baru per orang tua. Bila
   preferensi (mis. musik) perlu beda tiap anak, tambahkan kolom `child_id`
   lewat migrasi baru pada Phase 4.
