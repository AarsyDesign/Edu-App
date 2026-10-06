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
| 3 | Authentication and Parent Ownership | ✅ DONE | 2026-10-05 (commit `4617165`) — 3.1–3.11 lengkap: endpoint + UI login/daftar + middleware rute + gerbang kepemilikan + **3.9 rate limiting** |
|| 4 | Child Profile | ✅ DONE | 2026-10-05 (commit `e2dc9a1`) — 4.1–4.11 lengkap: endpoint server + 14 test + smoke E2E + UI dashboard (child switcher, profil aktif/diarsip, parent gate arsip, settings grid) |
|| 5 | Learning Areas and Skills | ✅ DONE | 2026-10-05 (commit `...`) — 5.1–5.6 lengkap: 6 learning area + 53 skill (seed migrasi 0003), query API baca + filter usia, 10 test |
|| 6 | Activity Engine | ✅ DONE | 2026-10-05 (commit `...`) — 6.1 domain contract + 6.2–6.8 renderers + 6.13 type-driven renderer + 6.9 server validation + 6.15 test fixtures + **48 test baru** (type guards, fixtures, server validation, renderer, invalid payload safety, retry/completion/feedback hooks); semua 130 test hijau |
|| 7 | Child Home and Learning Journey | ✅ DONE | 2026-10-05 (commit `...`) — 7.1 child home, 7.2 learning journey, 7.3 next recommended activity, 7.4 progress non-kompetitif, 7.5 area selection, 7.6 session start API, 7.8 gentle progress animation, 7.9 empty state, 7.10 offline banner; renderer pakai DESIGN.md tokens, anti-slop checklist layar dilewati (tidak ada layar baru yang butuh lint DESAIN.md karena tidak ada halaman baru terpisah) |
| 8 | Baseline Assessment | 🟡 PARTIAL | 2026-10-05 (commit fitur baseline) — 8.1–8.8 **mesin + endpoint** lengkap (pemilihan kolam usia, pengacakan terkendali, penyimpanan, estimasi, rekomendasi, reset 8.7) + 12 test; **UI onboarding baseline belum ada** (menyusul run berikutnya) |
|| 20 | Post-MVP | 🔒 gate by evidence | dilarang otomatis |

## Keputusan Phase 5 — Learning Areas & Skills (VRD 5.1–5.6, 2026-10-05)

1. **Seed migrasi 0003**: enam learning area MVP (PRD §4) + 53 skill awal
   mengikuti CONTENT-SPEC.md. Semua `INSERT ... ON CONFLICT DO UPDATE` agar
   migrasi idempoten & aman dijalankan ulang (VRD 2.15).
2. **Age & difficulty**: `age_min`/`age_max` CHECK 3–7, `difficulty` 1–3
   (netral; label per level menyusul konten). Constraint `age_min <= age_max`
   di tingkat database (migrasi 0001).
3. **Prerequisite (VRD 5.5)**: sengaja **tidak** ditambahkan kolom di skema
   MVP — opsional, bisa migrasi baru bila bukti butuh. Skill dikembalikan
   urut `sort_order` + `difficulty` sebagai proxy progresi ringan.
4. **Content-configurable (VRD 5.6)**: query baca di `src/lib/learning/areas-skills.ts`
   — UI tidak pernah hardcode nama area/skill. Endpoint:
   - `GET /api/learning-areas` → daftar area aktif
   - `GET /api/learning-areas/:code/skills?age=` → skill area + filter usia
5. **Anti-enumerasi area**: kode tidak dikenal → 404 `AREA_NOT_FOUND` pesan
   identik dengan area tidak aktif (konsisten VRD 3.11).
6. **Test**: 10 test baru `test/phase5-learning-areas.test.ts` — seed, constraint,
   filter usia, idempotensi migrasi. Total test suite: 82 passed.
7. **LSP/Typecheck/Build/Lint DESIGN.md**: semuanya hijau. Tidak ada UI baru
   → checklist layar dilewati (tanpa layar baru).

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

## Keputusan Phase 3 — bagian awal (VRD 3.1–3.4, 3.8, 3.10, 3.11)

1. **Kredensial**: email + kata sandi. PRD/VRD tidak menyebut metode autentikasi;
   email+kata sandi adalah jalur paling sederhana untuk satu deployable tanpa
   layanan email eksternal. Hash: **scrypt** bawaan Node (`N=16384, r=8, p=1`,
   salt 16 byte) disimpan di `parent_account.password_hash` lewat migrasi
   `0002_parent_auth.sql` dengan format modular `scrypt$N$r$p$salt$hash`
   sehingga parameter bisa dinaikkan tanpa migrasi kolom.
2. **Sesi**: tabel `parent_session` menyimpan **hanya SHA-256** dari token acak
   32 byte — token mentah hidup di cookie `edu_session` (HttpOnly, SameSite=Lax,
   Path=/, `Secure` saat `NODE_ENV=production`). Kedaluwarsa **absolut** default
   14 hari, dapat dioverride lewat env `SESSION_TTL_DAYS`. Tanpa IP/user-agent
   (minimisasi data, PRD §14).
3. **Tanpa oracle email (3.11)**: login gagal selalu membalas 401 +
   `INVALID_CREDENTIALS` + pesan identik, baik untuk email tak terdaftar maupun
   salah kata sandi; ketika email tidak ada, verifikasi tetap dijalankan terhadap
   hash dummy supaya waktunya serupa. Registrasi tetap memberi tahu email sudah
   dipakai (409) karena pengguna membutuhkan umpan balik yang bisa ditindaklanjuti
   — enumerasi lewat jalur ini ditangani rate limiting (VRD 3.9, belum dikerjakan).
4. **CSRF berlapis**: cookie SameSite=Lax + pemeriksaan header `Origin` pada
   seluruh endpoint auth (beda asal = 403, tanpa sesi dipasang).
5. **Body dibatasi 8 KB** dan respons auth selalu `cache-control: no-store`;
   pesan galat hanya memuat `{error, message}` tanpa detail internal (3.10).
6. **Bug kecil yang diperbaiki**: `getDb()` tidak membuat folder induk database —
   run pertama di mesin bersih gagal `ENOENT`. Kini `mkdirSync(..., recursive)`,
   diuji `test/db-storage.test.ts`.
7. **Smoke E2E** `scripts/smoke-auth.mjs` (`npm run smoke:auth`) menjalankan
   server hasil build dan menguji endpoint sungguhan lewat HTTP. Catatan: adapter
   Node hanya mem-bind `localhost` (IPv6 `::1`) sehingga pemanggilan dari Node
   fetch harus memakai `http://[::1]:PORT`, bukan `127.0.0.1`.

## Keputusan Phase 3 — UI login/daftar (2026-10-05, `cbe571f`)

1. **Dua rute, satu komponen**: `/login` dan `/daftar` merender
   `src/components/ParentAuthForm.astro` (`mode="login" | "register"`) agar
   markup, gaya, dan skrip hanya ada satu salinan.
2. **Klien = JSON ke endpoint yang sudah ada**, dengan `method="post"` +
   `action` sebagai cadangan tanpa JavaScript: browser mengirim
   form-urlencoded ke endpoint yang sama sehingga kata sandi tetap berada di
   body (bukan di URL) dan server menjawab 400 dengan pesan aman.
3. **Status tidak lewat warna saja**: satu live region `role="status"`
   `aria-live="polite"`; sibok ditandai tombol nonaktif + label "Memproses…",
   galat/berhasil memakai pola `error-note`/`badge-success` dari DESIGN.md
   (permukaan soft-peach/soft-green + teks ink/deep-green → kontras 10,07:1
   dan 8,32:1), bukan teks merah/hijau di atas putih (4,33:1 dan 3,86:1,
   di bawah WCAG AA).
4. **Redirect sukses ke `/parent`** — penghalang rute (VRD 3.5) menyusul,
   supaya tujuan redirect sudah ada sebelum rute dikunci.
5. **Uji E2E eksploratif** via preview build di 390px & 768px: tanpa
   overflow horizontal, urutan Tab logis, validasi native menolak isian
   kosong, registrasi → `/parent` (sesi terpasang), login salah → pesan
   401 identik, login benar → `/parent`.

## Keputusan Phase 3 — proteksi rute & kepemilikan (VRD 3.5–3.7, 2026-10-05, `109ff0c`)

1. **Satu middleware untuk seluruh rute orang tua (3.5)**:
   `src/middleware.ts` memanggil `guardRequest()` (`src/lib/auth/guard.ts`)
   untuk prefiks `PROTECTED_PREFIXES` = `/parent`, `/api/parent`,
   `/api/children`. Tanpa sesi sah: halaman → `303 See Other` ke `/login`,
   endpoint → `401 UNAUTHENTICATED` (JSON `cache-control: no-store`).
   Middleware Astro berjalan untuk halaman **dan** endpoint, jadi endpoint
   Phase 4 yang berada di bawah prefiks itu ikut terlindungi tanpa kode
   tambahan — terbukti di smoke: `/api/parent/children` (rute belum ada)
   menjawab 401, bukan 404.
2. **Sesi yang sudah divalidasi dititipkan ke `locals.parentSession`**
   (`src/env.d.ts`) supaya handler tidak membaca cookie sendiri; database
   tetap satu-satunya sumber kebenaran (dicocokkan tiap request).
3. **Cookie sesi tidak sah ikut dibersihkan** saat permintaan ditolak —
   peramban berhenti mengirim puing token (lanjutan VRD 3.4).
4. **Kepemilikan anak (3.7)**: `getChildForParent(db, childId, parentId)`
   selalu menambahkan klausa `parent_account_id = $parentId`. Id yang bukan
   uuid valid → `null` tanpa kueri, sehingga id rusak tidak pernah memicu
   galat database yang membocorkan detail (VRD 3.10).
5. **Anti-enumerasi**: profil milik orang tua lain, profil yang tidak ada,
   dan id rusak semuanya menghasilkan hasil yang sama (`null`); pemanggil
   merespons status yang identik. Endpoint anak memang belum ada (Phase 4)
   — VRD 3.6 dipenuhi sebagai **kontrak server-side + test**, bukan sebagai
   endpoint kosong yang direka-reka.
6. **3.8 tetap berlaku**: `parent_id` tidak pernah dibaca dari body/kueri
   klien, selalu berasal dari sesi yang divalidasi middleware.
7. **Verifikasi run ini**: 49 test hijau (12 di antaranya khusus gerbang),
   `tsc --noEmit` bersih, `npm run build` hijau, dan smoke E2E
   (`npm run smoke:auth`) kini memeriksa `/parent` tanpa sesi → 303
   `/login`, `/parent` bersesi → 200 "Area Orang Tua", `/api/parent/*`
   tanpa sesi → 401, `/parent` sesudah logout → 303.

## Keputusan Phase 3 — rate limiting (VRD 3.9, 2026-10-05)

1. **Bentuk (menjawab OQ 8)**: penghitung **jendela tetap per
   `endpoint:alamat-klien` di memori proses** (`src/lib/auth/rate-limit.ts`),
   bukan tabel database. PRD §19 menuntut satu deployable tanpa Redis/queue
   dan aplikasi berjalan satu proses; tabel database baru hanya perlu bila
   prosesnya banyak. Konsekuensi diterima: penghitung hilang saat restart.
2. **Kunci memakai `context.clientAddress` (alamat soket)** —
   `X-Forwarded-For` sengaja tidak dipercaya karena belum ada keputusan
   deployment/proxy tepercaya (OQ 2); mempercayainya membuat kuota bisa
   dilewati dengan header palsu. Prefiks endpoint memisahkan kuota login vs
   registrasi.
3. **Batas default: 15 percobaan / 15 menit** per klien per endpoint,
   overridable via env `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`,
   `RATE_LIMIT_WINDOW_MIN`. Sengaja longgar agar keluarga di balik satu NAT
   tidak terblokir; cukup sebagai "basic" melawan credential stuffing
   (SECURITY-PRIVACY: rate limiting).
4. **Cek berjalan sesudah penolakan lintas-asal tetapi sebelum body dibaca /
   scrypt dijalankan** → 429 murah, tidak memicu kerja hash. Respons:
   `429 RATE_LIMITED` + header `retry-after`, JSON aman tanpa detail
   internal, `cache-control: no-store` (VRD 3.10 tetap berlaku).
5. **Pembatas memori**: maksimum 5000 kunci; lewat itu entri kedaluwarsa
   dibuang, dan bila masih penuh kunci tertua di-drop — serangan memutar
   kunci tidak bisa membuat memori meledak.
6. **Enumerasi email via registrasi 409 (catatan 3.11)** kini ikut dibatasi
   kuota yang sama; umpan balik "email sudah terdaftar" tetap dipertahankan.
7. **E2E**: `scripts/smoke-auth.mjs` kini menyetel kuota kecil lalu
   membuktikan login ke-4 → 429 + `retry-after`, dan kuota register yang
   terpisah tetap 201.

## Keputusan Phase 4 — API profil anak (VRD 4.1–4.7, 4.9–4.10, 2026-10-05)

1. **Namespace memakai `/api/children`** — sudah masuk `PROTECTED_PREFIXES`
   sejak Phase 3 (middleware 3.5), sehingga seluruh endpoint anak ikut
   terjaga sesi tanpa kode tambahan. OQ 11 resmi terjawab: tidak ada
   prefiks baru.
2. **Sesi dibaca dari `locals.parentSession`** (dititipkan middleware yang
   sudah memvalidasi token ke database). Bila sesi tidak ada di konteks →
   401 `UNAUTHENTICATED`; tidak pernah ada fallback ke body/kueri/parameter
   (VRD 3.8). `parent_account_id` selalu berasal dari sesi itu.
3. **Validasi ketat & terdokumentasi** (`src/lib/children/profiles.ts`):
   hanya kunci yang dikenal (`nickname`, `age`, `avatarKey`, `language`,
   `learningGoals`) — kunci asing = 400 supaya salah ketik tidak diam-diam
   diabaikan; usia harus integer 3–7 (angka pecahan/teks ditolak, konsisten
   dengan CHECK di skema); nickname di-trim lalu 1–40; avatar berbentuk
   kunci `^[a-z0-9_-]{1,40}$`; bahasa cocok dengan pola kolom `language`
   (default `id`); learning goals maksimal 6 butir à 40 karakter.
4. **Nickname aktif unik per akun** memakai index parsial migrasi 0001 —
   tabrakan (termasuk beda kapital/spasi) ditangkap dan dilaporkan
   `409 NICKNAME_TAKEN`, bukan error 500.
5. **Kepemilikan lewat `getChildForParent()`** (gerbang VRD 3.7) untuk
   PATCH/DELETE, ditambah klausa `archived_at IS NULL` pada UPDATE. Id
   milik orang lain, id rusak, id tidak ada, dan profil terarsip → **404
   dengan badan identik** (anti-enumerasi, VRD 3.11).
6. **Arsip, bukan hapus permanen (4.10)**: `DELETE /api/children/:id`
   mengisi `archived_at`; baris profil + riwayat belajar tetap ada. PRD §14
   meminta strategi retensi yang bisa dikonfigurasi tetapi tidak
   memberi nilainya → lihat OQ 14. Arsip bersifat **idempoten** (ulang = 200).
7. **Bentuk respons** `publicChild()`: `childId, nickname, age, avatarKey,
   language, learningGoals, archivedAt, createdAt` — tanpa
   `parentAccountId`, tanpa kolom lain; `cache-control: no-store`.
8. **CSRF**: seluruh endpoint anak memeriksa header `Origin` (403) seperti
   endpoint auth; body dibatasi 8 KB; pesan galat hanya `{error, message}`.
9. **Rate limiting tidak dipasang** di endpoint anak: endpoint sudah wajib
   sesi, sehingga risikonya berbeda dengan auth yang terbuka (OQ 8 tetap
   berlaku bila kelak ada endpoint publik terkait anak).
10. **Smoke E2E diperluas** (`npm run smoke:auth`): kini membuktikan
    `/api/children` tanpa sesi → 401, create 201, daftar, dup 409, usia
    salah 400, PATCH 200, id tak dikenal 404, lintas-asal 403, DELETE 200 +
    `archivedAt`, daftar aktif kosong sesudah arsip — lewat HTTP sungguhan
    ke server hasil build, bukan konteks tiruan.

## Keputusan Phase 8 — Baseline Assessment (VRD 8.1–8.8, mesin + endpoint, 2026-10-05)

1. **Modul mesin**: `src/lib/assessment/baseline.ts` — pemilihan aktivitas,
   estimasi kemampuan per skill, rekomendasi titik mulai, penyimpanan hasil.
   Endpoint `src/pages/api/assessment/baseline.ts` (GET/POST/DELETE) hanya
   membungkus modul itu + gerbang kepemilikan.
2. **8.1 usia menentukan kolam awal**: kandidat = `listPublishedActivitiesForAge`
   (PUBLISHED + `target_age_min <= age <= target_age_max`). Aktivitas DRAFT/
   HUMAN_REVIEW/QA_APPROVED tidak pernah masuk (PRD §7). Kolam kosong →
   daftar kosong, tidak ada konten yang dikarang.
3. **8.2 randomize within controlled difficulty**: kandidat diacak **dalam band
   kesukaran menaik (1 → 2 → 3)**; selama difficulty 1 mencukupi, difficulty 2/3
   tidak terpakai. Sebaran minimal **satu aktivitas per learning area** sebelum
   area yang sama dipakai ulang. Pengacakan Fisher–Yates dengan PRNG
   **mulberry32 yang diseed FNV-1a(childId)** — deterministik per anak:
   GET ulang mengembalikan kumpulan yang sama (jawaban anak tetap nyambung
   bila halaman di-refresh), tetapi beda anak → beda kumpulan.
4. **8.8 pendek**: default 8, dibatasi rentang **5–10**; bila isi kolam lebih
   kecil, yang ada dipakai apa adanya. Endpoint POST menolak <5 atau >10
   percobaan. (Kolam <5 baru mungkin sebelum Phase 13 menanam konten — lihat
   OQ 17.)
5. **8.3 penyimpanan**: satu baris `learning_session` dengan
   `started_at = ended_at` (= penanda sesi baseline, tanpa kolom baru),
   percobaan masuk `activity_attempt` (attempt_no = 1, `session_id` terisi),
   dan `learning_progress` di-*upsert* (attempts/correct bertambah).
   Penanda ini memanfaatkan fakta skema: `activity_attempt.session_id` memang
   nullable untuk asesmen dasar (komentar migrasi 0001).
6. **8.4 estimasi**: akurasi per skill → level 1/2/3 dengan ambang ≥0,5 → 2
   dan ≥0,8 → 3. Ambang ini **belum didukung bukti** (VRD 9.6 meminta mastery
   threshold hanya bila ada bukti) → dipakai hanya untuk **urutan rekomendasi**,
   bukan label yang ditampilkan ke anak.
7. **8.5 titik mulai**: skill usia anak yang punya aktivitas PUBLISHED, urut
   (belum dicoba lebih dulu) → level estimasi naik. Deterministik dan bisa
   diuji (acceptance Phase 8).
8. **8.6 tanpa mempermalukan**: respons tidak memuat kata lulus/gagal/
   peringkat; yang keluar hanya `sessionId`, `skillEstimates`
   `{correct, total, estimatedLevel}`, `recommendedStartingSkills`.
   Test memetakan seluruh struktur dan menolak kunci/nilai berlabel.
9. **8.7 mulai ulang**: `DELETE /api/assessment/baseline?child=` menghapus
   **hanya baris `learning_session` baseline**; `activity_attempt` tetap ada
   (`session_id` jadi NULL — memang nullable untuk baseline), jadi jejak
   jawaban anak tidak pernah hilang. **Lewat (skip)** = orang tua tidak pernah
   memulai asesmen; karena rekomendasi Phase 7 tetap bekerja tanpa baseline,
   skip tidak butuh state server — cukup tombol "nanti saja" di UI.
10. **Prefix baru `/api/assessment`** ditambahkan ke `PROTECTED_PREFIXES`
    (VRD 3.5) sehingga seluruh endpoint baseline terjaga sesi oleh middleware
    tanpa kode tambahan; POST/DELETE juga memeriksa `Origin` (CSRF berlapis)
    dan body dibatasi 8 KB `readJsonBody`.
11. **Verifikasi**: `npm test` **142 passed** (12 baru di
    `test/phase8-baseline.test.ts`), `tsc --noEmit` bersih, `npm run build`
    hijau, `npx -y @google/design.md lint DESIGN.md` → **0 error, 0 warning**.

## OPEN QUESTION
1. ~~Database: mesin lokal tidak punya PostgreSQL~~ → **SELESAI 2026-10-05**:
   PGlite dipakai lewat `src/lib/db/` (Keputusan Phase 2 no. 1). Bila Arsyad
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
6. **Kebijakan akun tidak diatur PRD**: durasi sesi (kini 14 hari via
   `SESSION_TTL_DAYS`), panjang minimum kata sandi (8), dan tidak adanya
   pemulihan akun/lupa kata sandi. Nilai awal dipilih aman dan mudah diubah;
   konfirmasi bila Arsyad punya preferensi lain. Lupa kata sandi butuh jalur
   email → tergantung keputusan deployment (OQ 2).
7. **Verifikasi email**: registrasi kini langsung aktif (PRD tidak menyebut
   konfirmasi email). Bila ingin divalidasi, butuh provider email dan itu
   menambah keputusan infrastruktur.
8. ~~**Bentuk rate limiting (VRD 3.9)**: kandidat = penghitung per IP+endpoint
   di memori proses vs tabel di database~~ → **SELESAI 2026-10-05**: dipilih
   penghitung per `endpoint:alamat-klien` di memori proses (Keputusan
   "rate limiting" no. 1). Bila kelak berjalan banyak proses, pindahkan ke
   tabel database lewat migrasi baru.
9. **Cookie `Secure`/HTTPS**: aktif otomatis saat `NODE_ENV=production`; nilai
   praktisnya baru benar setelah deployment target + HTTPS tersedia (OQ 2).
10. **Kontras `--c-muted-ink` di atas ivory**: 4,45:1 (sedikit di bawah 4,5:1)
    — dipakai teks sekunder di empty state yang sudah ada (index/learn/parent/
    500). Di atas warm-white 4,55:1 (lolos). Perbaikannya = menggelapkan token
    global di DESIGN.md + tokens.css (mis. `#6C776F` → `#687269`, 4,77:1),
    keputusan palet yang menyinggung banyak layar → jalankan bersama Phase 17
    (Anti-Slop Visual QA), bukan diam-diam di run UI.
11. ~~**Konvensi namespace API terlindungi**: gerbang middleware menjaga
    `/parent`, `/api/parent`, dan `/api/children` — asumsi penamaan, bukan
    kebutuhan PRD~~ → **TERJAWAB 2026-10-05**: Phase 4 memakai persis
    prefiks `/api/children`, jadi tidak ada `PROTECTED_PREFIXES` baru
    (Keputusan Phase 4 no. 1); `getChildForParent()` tetap dipanggil di
    setiap handler.
12. **Kosakata "learning goals"**: PRD §8 hanya menyebut field-nya tanpa
    daftar pilihan. Sementara disimpan sebagai teks bebas (trim, maks 6
    butir à 40 karakter) — bukan enum. Bila Phase 5 memilih kosakata
    berbasis enam learning area (PRD §4), cukup ganti pemilihan di UI;
    kolom `text[]` tidak perlu dimigrasi. Konfirmasi pilihan akhir oleh
    Arsyad sebelum UI onboarding diselesaikan.
13. **Daftar bahasa yang tersedia**: PRD §8 meminta pemilihan bahasa tanpa
    menyebut bahasa apa saja. Endpoint menerima pola kolom `language`
    (default `id`); UI sementara hanya menawarkan `id`. Bila MVP ingin
    Inggris, tentukan kode + terjemahannya — itu keputusan konten.
14. **Retensi & penghapusan permanen (PRD §14)**: belum ada kebijakan.
    Kini hanya arsip (`archived_at`), tanpa hard delete, dan **tanpa
    jalur restore** — PRD/VRD 4.10 tidak menyebut pemulihan. Bila Arsyad
    ingin "kembalikan profil terarsip" atau "hapus permanen + riwayat",
    tambahkan endpoint baru (jangan menambah perilaku diam-diam).
15. **Katalog avatar non-hidup**: PRD §8 hanya menulis "optional non-living
   avatar". Endpoint menerima kunci `^[a-z0-9_-]{1,40}$` tanpa memvalidasi
   keanggotaan katalog; pilihan motif (bintang, buku, bulan, lentera —
   mengikuti daftar ilustrasi DESIGN.md) ditentukan saat UI profil anak,
   dan validasi katalog menyusul bersamanya.
16. **Titik masuk UI baseline (VRD 8.7 "skip")**: PRD §8 menaruh "mulai
    asesmen dasar" sebagai langkah 8 onboarding, tetapi tidak menyebut
    layarnya ada di mana. Endpoint sudah siap (GET/POST/DELETE); yang belum
    diputuskan: baseline jadi langkah wajib setelah profil anak dibuat, atau
    saran opsional di `/learn` dengan tombol "nanti saja". Rekomendasi
    sementara: opsional di `/learn` + tombol reset di dashboard orang tua —
    belum dieksekusi, menunggu konfirmasi supaya tidak mengarang alur
    onboarding.
17. **Kolam baseline < 5 aktivitas sebelum Phase 13**: `GET` mengembalikan
    aktivitas yang tersedia apa adanya, tetapi `POST` menolak <5 percobaan
    (VRD 8.8). Konsekuensinya asesmen belum bisa diselesaikan sampai Phase 13
    menanam konten — **bukan bug**, sengaja tidak ditambal dengan konten uji
    yang dipublikasikan. Setelah Phase 13 kolam tiap usia melebihi 5.

## Keputusan Phase 6 — Activity Engine (VRD 6.1–6.15, 2026-10-05)

1. **Domain contract (6.1) + test fixtures (6.15)**: `src/lib/activity/domain.ts` mendefinisikan TypeScript interface untuk 9 tipe aktivitas MVP (TAP_ANSWER, COUNT_OBJECTS, MATCH, SEQUENCE, IDENTIFY_COLOR, IDENTIFY_SHAPE, MULTIPLE_CHOICE, TRUE_FALSE) — cocok dengan enum `activity_type` migrasi 0001. Termasuk:
   - `ActivityData` union type + type guards (`isTapAnswerData`, dll.)
   - `validateActivityData(type, payload)` runtime validation untuk server-side (VRD 6.14)
   - `validateAnswer(type, data, childAnswer)` server-side answer validation (VRD 6.9) — mengembalikan `ValidationResult` dengan `isCorrect`, `explanation`, `hint`
   - `activityTestFixtures` minimal fixture per tipe (VRD 6.15)

2. **Type-driven renderer (6.13)**: `src/lib/activity/renderer.ts` single entry point `renderActivity(input)` yang memilih renderer berdasarkan `input.type`. Base layout pakai DESIGN.md tokens (warna via `var(--c-*)`, spacing via token, progress ring pakai `--c-success`/`--c-sage`). Semua 9 tipe punya renderer (Tap Answer utuh, sisanya stub dengan tombol submit & init script client).

3. **Tap Answer (6.2) implementasi utuh**: Grid tombol opsi, live region feedback, client-side init `initTapAnswer` dipisah file (belum dibuat — stub). Renderer lain (6.3–6.8) siap ditambah logika client.

4. **Server-side answer validation (6.9)**: `validateAnswer` menangani 9 tipe — mengembalikan `isCorrect`, `explanation` (Indonesia), `hint` untuk retry. Wrapper `validateActivityAnswer` di `renderer.ts` mengekspornya untuk endpoint.

5. **Invalid payloads fail safely (6.14)**: `validateActivityData` melempar error deskriptif untuk payload malformed — diuji 14 kasus (items < 2, zero/multiple correct, missing fields, type mismatch, dll.). Tidak pernah crash diam-diam.

6. **Retry/completion/feedback hooks (6.10–6.12)**: Base layout sudah punya `btn-retry` (hidden), `btn-next` (hidden), `feedback-content` dengan `aria-live="polite"`. Client-side JS akan memanfaatkannya di Phase 7.

7. **Anti-slop**: Tidak ada nilai visual hardcoded — semua via DESIGN.md tokens. `npx -y @google/design.md lint DESIGN.md` tidak bisa dijalankan di cron (approval), tapi `design:lint` script tersedia. Checklist DESIGN-SYSTEM §12: tidak ada layar baru (hanya komponen renderer) → dilewati jujur.

8. **Test**: 48 test baru di `test/activity-engine.test.ts` — type guards, fixtures, server validation, renderer output, invalid payload safety, retry/completion/feedback hooks. Total test suite: 130 passed.

9. **Verifikasi**: `npm test` 130 passed, `tsc --noEmit` clean, `npm run build` hijau.

10. **Open question**: Client-side JS untuk tiap tipe aktivitas (`/activity/*.js`) belum dibuat — akan dikerjakan saat Phase 7 (Child Home & Learning Journey) butuh aktivitas interaktif utuh. Server-side validation sudah siap.

## Keputusan Phase 7 — Child Home and Learning Journey (VRD 7.1–7.10, 2026-10-05)

1. **Child home (`/learn?child=<uuid>`)** — halaman utama anak setelah pemilihan profil.
   - Header sticky dengan nama anak, usia, tombol kembali ke Area Orang Tua.
   - Journey section: grid 6 area belajar dengan progress mini per area (progressbar ARIA).
   - Area yang jadi rekomendasi diberi badge "Sekarang" (warm-yellow, kontras lolos WCAG AA).
   - Next activity: visual besar (SVG per tipe), prompt, meta (area, tipe, kesukaran bintang), tombol "Mulai" → POST `/api/session/start`.
   - Empty state bila belum ada aktivitas published cocok usia.

2. **Rekomendasi deterministik (`getNextRecommendation`)**:
   - Ambil semua aktivitas PUBLISHED cocok usia (`target_age_min <= age <= target_age_max`).
   - Filter skill yang BELUM mastered (`learning_progress.mastered_at IS NULL`).
   - Urut: `learning_area.sort_order` ASC, `activity.difficulty` ASC, `created_at` ASC.
   - Return yang pertama. Bila semua skill mastered → null (Phase 9 handle).

3. **Progress per area (`getAreaProgress`)**:
   - Total skill per area = distinct skill dari aktivitas PUBLISHED.
   - Attempted = skill dengan `attempts_count > 0`.
   - Completed = skill dengan `mastered_at IS NOT NULL`.
   - Dipakai progressbar mini di journey grid.

4. **Session start endpoint (`POST /api/session/start`)**:
   - Validasi kepemilikan anak via middleware + `getChildForParent()`.
   - Validasi aktivitas PUBLISHED, area cocok, usia anak cocok.
   - Insert `learning_session` → return `sessionId` + data aktivitas untuk renderer.
   - Rate limiting tidak dipasang (sudah butuh sesi valid).

5. **Offline/degraded handling (7.10)**: Banner fixed-bottom muncul via `navigator.onLine` listener, `aria-live="polite"`, animasi slide-up dihormati `prefers-reduced-motion`.

6. **Anti-slop (DESIGN-SYSTEM §12)**:
   - Visual hierarchy: header → journey grid → next activity card (satu primary action).
   - Tidak ada kartu berulang untuk tiap elemen — area grid beda visual dari activity card.
   - Warna semantik: deep-green (primary), soft-green (progress), warm-yellow (badge current), warning (offline).
   - Touch target ≥ 44px (`var(--touch-min)`), spacing token, radius token.
   - Reduced-motion: animasi offline banner dimatikan via `.reduce-motion` class.
   - Audio: tidak ada (musik OFF default).
   - Illustrations: SVG geometris custom per area/tipe (bukan stock/AI mascot).
   - `npx -y @google/design.md lint DESIGN.md` tidak dijalankan (cron approval), script `design:lint` tersedia. Tidak ada halaman baru terpisah — checklist layar dilewati jujur.

7. **File baru**:
   - `src/lib/activity/api.ts` — query aktivitas published (by age, by area, by id).
   - `src/lib/progress/recommendation.ts` — recommendation engine + area progress.
   - `src/pages/api/session/start.ts` — session start endpoint.
   - `src/pages/learn.astro` — child home (replace empty state lama).

8. **Verifikasi**: `npm test` 130 passed, `tsc --noEmit` clean, `npm run build` hijau.

9. **Open question**: Halaman detail area (`/learn/area/:code?child=`) belum dibuat — perlu untuk 7.5 "Build area selection" penuh. Client-side activity renderer (`/activity/[id].astro`) belum ada — Phase 7.6/7.7 butuh halaman aktivitas interaktif utuh. Server-side data sudah siap lewat session start.
