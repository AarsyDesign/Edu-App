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
|| 4 | Child Profile | ✅ DONE | 2026-10-05 (commit `e2dc9a1`) — 4.1–4.11: endpoint server + 14 test + smoke E2E + UI dashboard (child switcher, profil aktif/diarsip, settings grid); **2026-10-06 UI buat/ubah/arsip profil** (`/parent/profil/baru`, `/parent/profil/:id/edit`) menutup tautan mati di dashboard |
|| 5 | Learning Areas and Skills | ✅ DONE | 2026-10-05 (commit `...`) — 5.1–5.6 lengkap: 6 learning area + 53 skill (seed migrasi 0003), query API baca + filter usia, 10 test |
|| 6 | Activity Engine | ✅ DONE | 2026-10-05 (commit `...`) — 6.1 domain contract + 6.2–6.8 renderers + 6.13 type-driven renderer + 6.9 server validation + 6.15 test fixtures + **48 test baru** (type guards, fixtures, server validation, renderer, invalid payload safety, retry/completion/feedback hooks); semua 130 test hijau |
|| 7 | Child Home and Learning Journey | ✅ DONE | 2026-10-05 (commit `...`) — 7.1 child home, 7.2 learning journey, 7.3 next recommended activity, 7.4 progress non-kompetitif, 7.5 area selection, 7.6 session start API, 7.8 gentle progress animation, 7.9 empty state, 7.10 offline banner; **2026-10-06 (run ini)**: 7.5 halaman detail area (menutup OQ 19) + 7.6/7.7 layar aktivitas interaktif, endpoint `/api/activity/attempt` & `/api/session/complete`, sesi per-tampilan, smoke E2E `SMOKE_LOOP_OK` (23 cek) |
| 8 | Baseline Assessment | 🟡 PARTIAL | 2026-10-05 (commit fitur baseline) — 8.1–8.8 **mesin + endpoint** lengkap (pemilihan kolam usia, pengacakan terkendali, penyimpanan, estimasi, rekomendasi, reset 8.7) + 12 test; **UI onboarding belum ada** — terblokir OQ 16 (titik masuk, butuh konfirmasi) + OQ 17 (kolam <5 sampai Phase 13 menanam konten) |
|| 9 | Progress Engine | 🟡 PARTIAL | 2026-10-06 — **9.1–9.5 mesin + test** (`src/lib/progress/engine.ts`), **9.8 ringkasan orang tua** `src/lib/progress/summary.ts` + `GET /api/parent/progress` (run ini); 9.7 tanpa label; **9.6 ditahan** (tanpa bukti → OQ 23) |
|| 10 | Parent Dashboard | 🟡 PARTIAL | 2026-10-07 — **10.1 child overview**: `/parent/anak/:id` merender `getParentProgressSummary` (3 fakta + empty state) + tautan "Ringkasan" di kartu profil; **10.2 sessions**: daftar sesi belajar (badge Asesmen/Terbuka, jumlah jawaban, durasi, selesai) — **DONE** (commit `f7f2427`); **10.3 learning areas**: baris per area + progressbar (attempted/total skill) + teks "n selesai" + aria-label — **DONE** (commit `a1708cd`); **10.4 kekuatan** + **10.5 saran latihan** — **DONE** (komit `130506b`/`d31c1ff`, dirapikan + diuji 2026-10-07: judul skill manusiawi, sampel `n jawaban`, label tipe/tingkat, empty state saran); 10.6 grid pengaturan sudah ada; **10.9 kepadatan dashboard ✅ DONE 2026-10-08** (inventaris bagian dikunci gerbang + bukti peramban 390/768px, lihat "Keputusan — VRD 10.9"); **10.7/10.8/10.10: halaman placeholder sudah ada** (commit `b6443ba` audio+privasi, `690a353` durasi sesi, 2026-10-08) — tautan di dashboard tidak lagi 404, tetapi **perilaku fiturnya tetap menunggu keputusan produk (OQ 5, OQ 14, OQ 18)**; salinan layar dibersihkan dari jargon internal + checklist anti-slop diverifikasi di peramban **2026-10-09 (run ini)**, lihat "Keputusan — copy tanpa jargon internal (2026-10-09)" |
|| 11 | Content Management | ✅ DONE | 2026-10-07 — **11.1** autentikasi reviewer (commit `94c890c`) + **11.2 editor aktivitas**: daftar `/reviewer/aktivitas` (saringan area/status, paginasi), buat `/reviewer/aktivitas/baru`, edit `/reviewer/aktivitas/:id` (8 panel tipe sesuai CONTENT-SPEC), API buka/ubah/hapus + gerbang status; **11.3 learning area selector** ikut beres (dropdown area+skill terfilter); 11.4–11.10 server validation ikut tercakup `parseEditorPayload`; **11.11 transisi status** (matriks PRD §7 di aplikasi + trigger DB, endpoint `/status`, jejak `content_review` + riwayat di layar detail); **11.12 pratinjau sebagai anak** (halaman `/reviewer/aktivitas/:id/pratinjau` + endpoint `/preview`, menilai tanpa tulis data); **11.13** dijaga matriks + trigger; **11.14 feed anak tertutup untuk konten non-published** (`test/phase11-14-draft-feed.test.ts`: 5 status disembunyikan dari semua jalur baca anak, endpoint sesi/jawaban 404 tanpa tulis, guard sumber `FROM activity` wajib saring `PUBLISHED`; baseline GET re-select ikut disaring) — **2026-10-07 run ini** |
|| 12 | AI-Assisted Draft Pipeline | ✅ DONE | 2026-10-07 (run ini) — **12.1** skema batch draf + templat prompt (`docs/AI-DRAFT-SCHEMA.md`, konstanta `AI_DRAFT_SCHEMA_VERSION`/`DRAFT_BATCH_MAX` di `src/lib/activity/ai-draft.ts`); **12.3/12.4** `parseDraftBatch` memvalidasi amplop + tiap draf (divalidasi ulang `parseEditorPayload`), satu draf gagal → batch utuh `400 DRAFT_BATCH_INVALID` "Draf ke-N: …" tanpa tulis apa pun; **12.5** `content_origin` DIPAKSA `AI_DRAFT` (klaim draf tak pernah dibaca); **12.6** `POST /api/reviewer/aktivitas/import` menyimpan batch sebagai `DRAFT` di antrean reviewer + **UI impor** `/reviewer/aktivitas/impor` (tempel JSON/unggah file, validasi client-side, status live region, redirect ke daftar); **12.15** kolom `version` sudah ada & +1 saat edit (Phase 11). **12.2 menunggu OQ 26** (provider/model); 12.7–12.13 = proses review manual memakai checklist CONTENT-SPEC di antrean yang sudah ada |
| 13 | Seed 100 Activities | 🔒 gate review Arsyad | dilarang ditanam otomatis — impor batch lewat `/reviewer/aktivitas/impor` menunggu konten yang direview manusia (PRD §5/§7) |
| 14 | Audio and Motion (audit 14.4–14.7) | ✅ DONE | 2026-10-07 — 14.4 musik OFF default, 14.5/14.6 animasi 120–700ms (token), 14.7 prefers-reduced-motion mematikan gerak non-esensial; audit verifikasi, tanpa penemuan; 14.1–14.3 tertahan OQ 18/5 |
| 15 | Privacy and Child Safety Review | ✅ DONE | 2026-10-07 — **15.1–15.10 lengkap**: inventory field anak (hanya minimal PRD §8), data anak tidak publik (middleware + `getChildForParent` + smoke E2E), child mode terisolasi tanpa komunitas, parent gate di semua aksi sensitif, tanpa external link child mode, tanpa purchase gateway, log tanpa PII anak (tes `privacy-logs`), analytics diminimalkan (tidak ada library tracking), retensi terdokumentasi di `PRIVACY-AUDIT.md` (arsip soft-delete, OQ 14 terbuka) |
| 16 | Quality Assurance | ✅ DONE | 2026-10-07 (commit `0a01b42`) — 16.1–16.18 dipenuhi lewat TDD lintas Phase 0–15; **2026-10-09 (run ini)** QA E2E eksploratif layar anak (16.10–16.13 viewport/sentuh) → 4 temuan diperbaiki, lihat "Keputusan — QA E2E eksploratif layar anak" |
| 17 | Anti-Slop Visual QA | ✅ DONE | 2026-10-07 (commit `1931538`) — semua layar meresponsive, hierarki tunggal per layar, sentuh target ≥44px, nilai visual hanya token, tanpa hex hardcoded, tanpa durasi ms hardcoded, tanpa animasi perpetual, tanpa karakter manusia/hewan, musik OFF default, prefers-reduced-motion lewat token, `npx -y @google/design.md lint DESIGN.md` → 0 error 0 warning; **2026-10-08 (run ini)** OQ 10 ditutup: token `--c-muted-ink` `#5C665E` lolos WCAG AA di semua permukaan pemakaian + `test/color-contrast.test.ts`; **2026-10-08 (run ini)** QA E2E eksploratif 5 layar reviewer di browser (390/768px) → perbaikan hierarki aksi primary + skip-link 44px, dikunci `test/anti-slop-action-hierarchy.test.ts`; **2026-10-08 (run ini)** QA E2E eksploratif layar orang tua (390/768px) → **OQ 28 ditutup** (CTA header jadi sekunder) + hover kartu profil lolos AA; **2026-10-08 (run ini)** **OQ 30 ditutup**: banner offline child home `--c-soft-peach` + `--c-ink` (10,07:1) + gerbang pasangan `background`+`color` seluruh `src/` (85 pasangan ≥4,5:1), dibuktikan offline-emulation 390/768px |
| 18 | Performance | ✅ DONE | 2026-10-07 (run ini) — 18.1–18.8 terukur: `npm run perf` (`scripts/perf-measure.mjs`) + QA browser 390px/768px; rincian di "Keputusan Phase 18"; dua catatan jujur: `/activity/runtime.js` tanpa header cache panjang (OQ 27) & 18.7 diukur sebagai proxy heap/DOM, bukan perangkat rendah sungguhan |
| 19 | Deployment | ⏸ menunggu OQ 2 | deployment target belum diputuskan |
| 20 | Post-MVP | 🔒 gate by evidence | dilarang otomatis |

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
3. ~~**Identitas reviewer konten**: `activity.reviewed_by` dan
   `content_review.reviewer` berupa `uuid` tanpa FK karena akun reviewer harus
   terpisah dari akun orang tua (PRD §13) dan tabelnya belum ada. Putuskan di
   Phase 11 (Content Management) lalu tambahkan FK lewat migrasi baru.~~ →
   **SELESAI**: migrasi `0004_reviewer_account.sql` membuat `reviewer_account`
   + `reviewer_session` dan menambahkan FK ke kedua kolom itu.
4. ~~**Matriks transisi status konten**: PRD §7 menyebut alur produksi tapi tidak
   memberi daftar transisi eksplisit. Skema kini hanya memvalidasi `from ≠ to`
   + enum. Aturan transisi yang sah diputuskan di Phase 11, bukan dikarang di
   sini.~~ → **SELESAI 2026-10-07** (VRD 11.11): matriks diturunkan persis dari
   PRD §7 dan kini dijaga dua lapis — `src/lib/activity/review-flow.ts`
   (aplikasi) + trigger `content_review_check_transition` (migrasi 0005).
   Rinciannya di "Keputusan Phase 11 (lanjutan) — transisi status".
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
10. ~~**Kontras `--c-muted-ink` di atas ivory**: 4,45:1 (sedikit di bawah
    4,5:1) — dipakai teks sekunder di empty state yang sudah ada
    (index/learn/parent/500). Di atas warm-white 4,55:1 (lolos).~~ →
    **SELESAI 2026-10-08** (lihat "Keputusan — OQ 10" di bawah): token
    digelapkan ke `#5C665E` sehingga lolos AA di atas ivory (5,70:1),
    warm-white (5,83:1), soft-green (4,91:1) dan soft-peach (4,56:1);
    dikunci test `test/color-contrast.test.ts`.
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
    onboarding. **Juga terblokir OQ 17**: sampai Phase 13 menanam konten,
    kolam <5 dan layarnya akan selalu buntu — jangan dibangun lebih dulu.
17. **Kolam baseline < 5 aktivitas sebelum Phase 13**: `GET` mengembalikan
    aktivitas yang tersedia apa adanya, tetapi `POST` menolak <5 percobaan
    (VRD 8.8). Konsekuensinya asesmen belum bisa diselesaikan sampai Phase 13
    menanam konten — **bukan bug**, sengaja tidak ditambal dengan konten uji
    yang dipublikasikan. Setelah Phase 13 kolam tiap usia melebihi 5.
18. **Tautan pengaturan di dashboard dulu 404** — ~~selesai 2026-10-08~~:
    `/parent/pengaturan/audio`, `/parent/pengaturan/privasi` (commit `b6443ba`)
    dan `/parent/pengaturan/sesi` (commit `690a353`) kini ada sebagai
    **halaman placeholder** yang menyatakan ketersediaan lewat teks. Yang
    **masih terbuka**: perilaku sebenarnya — preferensi audio (OQ 5 + OQ 18),
    batas durasi sesi (OQ 5), retensi/hapus permanen/unduh data (OQ 14).
    Placeholder sengaja tidak menyimpan preferensi apa pun supaya tidak
    mengarang keputusan produk.
19. **Tautan area di child home masih 404** — ~~selesai 2026-10-06~~:
    halaman `/learn/area/:code?child=` sudah ada (menyaring aktivitas PUBLISHED
    per area + usia anak, tautan kembali ke `/learn`, area tak dikenal diam-diam
    kembali ke `/learn`), diverifikasi E2E oleh `scripts/smoke-loop.mjs`
    (`SMOKE_LOOP_OK`).
20. **Jalur tulis butuh JavaScript**: formulir profil anak mengirim JSON ke
    `/api/children`, dan aksi arsip memakai `fetch DELETE` — tanpa JavaScript
    browser mengirim POST form-urlencoded sehingga server menjawab 400/405
    yang aman (tanpa data tersimpan). Ini mengikuti pola `ParentAuthForm`
    yang sudah ada; bila kelak butuh dukungan non-JS penuh, tambahkan
    parsing `application/x-www-form-urlencoded` + method override di endpoint
    (keputusan keamanan, bukan perbaikan diam-diam).
21. ~~**Konvensi payload aktivitas belum terdokumentasi (Phase 7.6, 2026-10-06)**~~ →
    **SELESAI 2026-10-06**: konvensi kini mengikat di **CONTENT-SPEC §7**
    ("Activity Payload Conventions": §7.1 dua jalur pembentukan, §7.2 tabel
    per tipe, §7.3 aturan keras, §7.4 cek eksekusi) — rujukan lama
    "§7.13" tidak pernah ada, karena CONTENT-SPEC tidak berbagi nomor
    bagian. Spesifikasi eksekusi: `test/content-payload-conventions.test.ts`
    (6 test) mengkodekan tiap fixture ke bentuk baris lalu membangun ulang,
    memeriksa penilaian benar/salah per tipe, kasus gagal aman, penolakan
    `colorValue` bukan-heks, dan anti-drift (tabel §7.2 wajib memuat kedelapan
    tipe). **Phase 13 kini punya kontrak penyimpanan yang bisa diuji.**
22. **Akses child home harus login orang tua (keputusan sementara)**: PRD tidak
    menulis apakah `/learn` boleh dibuka tanpa sesi. Karena `learn.astro`
    sudah mengunci kepemilikan via `locals.parentSession` (VRD 3.7) dan aturan
    keras "data anak tidak boleh publik", `/learn` + `/learn/**` ditambahkan ke
    `PROTECTED_PREFIXES` (sebelumnya halaman itu selalu 302 ke `/login` untuk
    semua orang — termasuk orang tua yang sudah masuk, jadi tidak ada perilaku
    yang hilang). Bila PRD nanti menghendaki mode anak-membuka-sendiri, putuskan
    ulang di sini.

23. **Bukti untuk ambang mastery (VRD 9.6) & rekomendasi yang tidak pernah
   bergeser**: `mastered_at` belum pernah terisi di database, jadi
   `getNextRecommendation` selalu mengembalikan aktivitas pertama pada urutan
   (area, difficulty, created_at) — anak yang sudah menjawab benar tetap
   disarankan aktivitas yang sama. VRD 9.6 melarang menambahkan ambang tanpa
   bukti, jadi ini **tidak ditambal diam-diam** (diuji: `mastered_at` tetap
   NULL setelah 5 jawaban benar beruntun). Putuskan salah satu:
   (a) bukti apa yang cukup (mis. N jawaban benar berurutan — nilainya dari
   data Phase 13), (b) rekomendasi cukup berbasis fakta yang sudah ada (skill
   yang belum pernah dicoba didahulukan — tanpa label "selesai"), atau
   (c) tunda sampai konten Phase 13 memberi sebaran yang wajar.
   Rekomendasi sementara: **(b)** — bukti nyata dari riwayat percobaan, tanpa
   ambang keakuratan apa pun. Konfirmasi sebelum dieksekusi.

24. **Konten terbit boleh diedit? (status terkunci, 2026-10-07)**: PRD/VRD tidak
   memutuskan apakah aktivitas `PUBLISHED` boleh diubah langsung oleh reviewer.
   Implementasi sementara (11.2): editor hanya menerima `DRAFT`, `FLAGGED`,
   `UNPUBLISHED`; status lain → 409 `REVIEW_STATUS_LOCKED`, jadi tidak ada jalur
   melewati persetujuan. Bila konten terbit memang harus bisa diperbaiki cepat,
   jalurnya tetap: tarik ke `UNPUBLISHED` (11.11) → edit → review lagi.
   Konfirmasi atau ubah.

25. **Bentuk field "source" (VRD 11.9)**: VRD menyebut "field `source`" (tunggal,
   satu layar), sedangkan migrasi 0001 punya tabel `content_source` multi-baris
   (title, type, reference, methodology, disputed). Implementasi memakai tabel
   multi-baris dengan maksimal 5 sumber per aktivitas karena jalur 2 pembacaan
   konten (`content.ts`) memang membaca tabel itu. Bila yang dikehendaki cukup
   satu baris sederhana, permudah UI-nya.

26. **Penyedia/model AI untuk VRD 12.2 (generate batch draf)**: PRD §5/§14
   hanya menetapkan alurnya (`AI draft → human review → … → publish`) tanpa
   menyebut provider, model, atau kredensial, dan PRD §19 melarang AI di jalur
   runtime anak. Skema + validasi + penandaan `AI_DRAFT` (12.1, 12.3–12.5)
   **sudah dibuat 2026-10-07** tanpa provider — lihat
   `docs/AI-DRAFT-SCHEMA.md` + `POST /api/reviewer/aktivitas/import`
   (batch draf kini bisa masuk dari sumber mana pun, ditandai `AI_DRAFT`
   berstatus `DRAFT`). Yang masih menunggu: 12.2 "generate small batches"
   butuh keputusan — API eksternal (kunci di env, bukan di repo), model
   lokal, atau cukup impor manual dari berkas. Jangan menebak.

27. **Header cache aset `public/` (temuan VRD 18.5, 2026-10-07)**:
   `/activity/runtime.js` (dan modul tipe lain, nama tetap) dilayani adapter
   Astro dengan `cache-control: public, max-age=0` + ETag, tetapi tidak
   menjawab 304 untuk `If-None-Match` → 8,5 KB diunduh ulang tiap kunjungan
   layar aktivitas. Header file `public/` ditentukan adapter **sebelum**
   middleware aplikasi, jadi pilihan perbaikannya: (a) biarkan (dampak
   kecil), (b) pindahkan berkas ke rute SSR/hash nama (repot, tapi bikin
   immutable), atau (c) tambah reverse proxy yang mengatur header saat
   deploy (bergantung OQ 2). Aset ber-hashed `/_astro/*` sudah `immutable`
   1 tahun — tidak ada masalah di sana. Keputusan ditahan; jangan diubah
   diam-diam.

28. ~~**Hierarki aksi ganda di layar orang tua (temuan QA 2026-10-08)**:
   `/parent/anak/:id` merender dua `btn-primary` pada layar yang sama —
   "Buka layar belajar" (header) dan "Mulai Aktivitas Ini" (bagian saran
   latihan) — padahal DESIGN.md menetapkan `button-primary` sebagai
   satu-satunya aksi high-emphasis per layar.~~ → **SELESAI 2026-10-08**
   (lihat "Keputusan — QA E2E eksploratif layar orang tua + penutupan
   OQ 28"): rekomendasi dieksekusi persis — "Mulai Aktivitas Ini" tetap
   primary (PRD §12 *what to practice next*), "Buka layar belajar" turun ke
   `btn-secondary`, diverifikasi browser di 390px & 768px (tepat 1 primary
   per layar) dan dikunci test baru. Empty state ("Mulai Belajar") tetap
   primary di cabang `hasData` yang berbeda — keduanya tidak pernah tampil
   bersamaan.

29. **Transisi status memuat ulang halaman — edit belum tersimpan hilang
   diam-diam (temuan QA 2026-10-08)**: `ReviewFlowPanel` memanggil
   `window.location.reload()` setelah transisi sukses (Keputusan Phase 11
   lanjutan no. 4), sedangkan formulir edit di layar yang sama belum tentu
   sudah disimpan. Karena itu hierarki run ini menjadikan "Simpan
   Perubahan" satu-satunya aksi primary (lihat "Keputusan — QA E2E
   eksploratif layar reviewer"). Yang belum diputuskan: apakah perlu
   guard produk (peringatan "ada perubahan belum disimpan" sebelum
   transisi, atau simpan otomatis) — perilaku baru, jangan ditambahkan
   tanpa konfirmasi.

30. ~~**Kontras banner offline di child home (temuan QA layar orang tua,
   2026-10-08)**: `.offline-banner` (`src/pages/learn.astro`) memakai
   latar `--c-warning` dengan teks `--c-warm-white` → **2,91:1**; bahkan
   teks `--c-ink` di atas warning hanya **4,43:1**, jadi tidak ada token
   teks yang lolos di latar warning mana pun (dihitung node, bukan
   perkiraan). DESIGN.md membatasi warning untuk *status indicators
   (dots, icons, fills), always paired with text* — bukan latar teks.
   Rekomendasi: pindahkan latar banner ke permukaan tint `--c-soft-peach`
   + teks `--c-ink` = **10,07:1** (pola `error-note`), kunci dengan tes
   kontras.~~ → **SELESAI 2026-10-08** (lihat "Keputusan — OQ 30" di
   bawah): banner kini `--c-soft-peach` + `--c-ink` (10,07:1), dikunci
   dua tes di `test/color-contrast.test.ts` — kunci pasangan banner itu
   **dan** gerbang baru yang memindai seluruh `src/` untuk pasangan
   `background`+`color` eksplisit (85 pasangan, semua ≥4,5:1; ≥50 pasangan
   wajib terdeteksi supaya gerbang tidak bisa lolos membisu). Bukti
   peramban 390px & 768px dengan emulasi offline.

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

9. **Open question**: ~~Halaman detail area (`/learn/area/:code?child=`) belum
   dibuat~~ (selesai 2026-10-06, lihat Keputusan Phase 7 lanjutan di bawah) —
   Client-side activity renderer juga sudah ada sejak run 2026-10-06.

## Keputusan Phase 7 (lanjutan) — area detail + layar aktivitas (VRD 7.5–7.7, 2026-10-06)

Konteks: child home sudah ada tetapi dua tautan inti belum berfungsi —
area 404 (OQ 19) dan tombol "Mulai" mengirim POST form ke endpoint yang tidak
pernah merespons halaman. Run ini menutup **loop belajar utuh**: anak pilih
aktivitas → menjawab → umpan balik → progres tersimpan.

1. **Halaman detail area `/learn/area/:code?child=` (7.5)**:
   - Gerbang server urut: sesi orang tua (middleware) → kepemilikan `?child=`
     (`getChildForParent`) → `getLearningAreaByCode` → daftar aktivitas
     PUBLISHED `target_age_min <= usia <= target_age_max`.
   - Area tak dikenal/tidak aktif → dialihkan kembali ke `/learn?child=`
     (anti-enumerasi, sama dengan perilaku area kosong).
   - Tampilan: judul area, daftar baris aktivitas (prompt + tipe + tingkat
     1–3 dengan teks & bintang, bukan warna saja), tombol "Mulai" menuju
     `/learn/aktivitas/:id?child=`. Tanpa aktivitas → empty state + tautan
     kembali. Tanpa JavaScript pun semua tautan tetap berfungsi (MVP offline,
     tidak mengklaim dukungan non-JS penuh).

2. **Sesi belajar (7.6/7.7) — keputusan: satu sesi per tampilan aktivitas**:
   - `GET /learn/aktivitas/:id?child=` bila belum membawa `session` valid
     membuat `learning_session` lalu redirect dengan `session=<uuid>` — muat
     ulang tidak membuat sesi baru (diuji E2E).
   - `POST /api/session/complete {sessionId, childId}` (idempoten) menutup
     sesi; dipanggil klien sebelum tombol "Beranda"/"Aktivitas Berikutnya".
   - **Sesi baseline (`started_at = ended_at`) ditolak** untuk jawaban maupun
     penutupan — penanda baseline untuk VRD 8.8 dipertahankan utuh.
   - `POST /api/session/start` lama dibiarkan (kontrak Phase 7 sebelumnya),
     tetapi child home kini menautkan langsung ke layar aktivitas.

3. **Penilaian di server (6.9) — `POST /api/activity/attempt`**:
   - Body `{childId, activityId, sessionId, answer, durationMs?}`; status:
     401 tanpa sesi, 403 lintas asal, 404 aktivitas tak dikenal/draft atau
     anak bukan milik sesi ini, 400 sesi asing/sesi baseline/payload tak
     valid, 400 `ACTIVITY_NOT_READY` bila payload belum bisa dibentuk.
   - Benar-salah dihitung ulang **hanya dari data server** (`validateAnswer`);
     klaim `isCorrect` dari klien diabaikan (diuji).
   - Menyimpan `activity_attempt` (percobaan ke-N), `learning_session` (durasi
     + jumlah jawaban), dan `learning_progress` (attempts/mastery) dalam satu
     query — inilah "progress tersimpan" di sasaran loop.
   - Bahasa umpan balik netral (PRD §10): hanya "Benar!" / "Belum tepat." +
     penjelasan; daftar kata lulus/gagal/peringkat dibersihkan di test.

4. **Layar aktivitas (`/learn/aktivitas/:id`) — render type-driven**:
   - `src/lib/activity/content.ts` memetakan baris `activity` +
     `activity_option` → `ActivityData` lalu `renderActivity` (VRD 6.13/6.14);
     payload yang tidak valid → layar "Aktivitas Belum Siap" tanpa sesi dan
     tanpa interaksi (bukan error 500).
   - Klien: `public/activity/runtime.js` + satu modul per tipe — kumpulkan
     jawaban, kirim ke server, tampilkan umpan balik, tutup sesi. Tidak ada
     penilaian di klien. Gaya masuk lewat `src/styles/activity.css`
     (token-only).
   - Perbaikan renderer ikut dikerjakan: swatch warna/bentuk yang tadinya
     ter-escape jadi teks kini dirender benar (`labelHtml` + `safeHexColor`
     yang menolak nilai bukan-heks), `data-option-id` dan injeksi id ke JS
     di-escape (audit kecil keamanan konten).

5. **Gerbang rute**: `PROTECTED_PREFIXES` kini mencakup `/learn`,
   `/learn/**` (via prefiks `/learn`), `/api/activity`, `/api/session` —
   lihat OQ 22 untuk alasan `/learn`.

6. **Bug yang ditemukan & diperbaiki saat E2E**:
   - `listPublishedActivitiesForAreaAndAge` memakai `a.sort_order` yang tidak
     ada di tabel `activity` → halaman area 500. Diurutkan ulang:
     difficulty, created_at, id.
   - `sessionBelongsToChild` membaca `(started_at = ended_at)` yang menghasilkan
     `NULL` (bukan `false`) untuk sesi terbuka → sesi valid selalu ditolak.
     Diperbaiki dengan `COALESCE(..., false)` (pola sama di endpoint attempt).

7. **Verifikasi**:
   - `npm test` **164 pass / 0 fail** (13 test baru `test/phase7-learning-loop.test.ts`:
     pemetaan payload per tipe, guard kepemilikan, penilaian server idempoten,
     penyimpanan attempt+progress, penutupan sesi, statistik statis layar).
   - `npx tsc --noEmit` bersih; `npm run build` hijau.
   - **Smoke E2E HTTP nyata** `node scripts/smoke-loop.mjs` → `SMOKE_LOOP_OK`
     (23 cek, database segar + 1 aktivitas PUBLISHED ditanam; mencakup alur
     pilih area → jawab → feedback → progres → sesi selesai, termasuk
     penolakan lintas-asal, sesi asing, dan profil anak milik orang lain).
   - `design.md lint DESIGN.md` → **0 error, 0 warning** (CLI cache lokal
     `node …/_npx/…/@google/design.md/dist/index.js lint` — `npx -y` diblokir
     pemindai keamanan lingkungan).
   - **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** dua layar baru:
     hierarki tunggal per layar (judul → prompt → aksi utama); daftar area
     memakai baris fungsional, bukan grid kartu identik; touch target ≥44px
     (`--touch-min`) di semua tombol pilihan & input angka; tingkat ditandai
     teks+bintang, status jawaban ditandai ikon ✓/✗ + teks (bukan warna saja);
     nilai visual hanya dari `tokens.css` (semua var `--c-*`/`--sp-*`/`--fs-*`;
     hex `#174A3A` hanya pada SVG geometris mengikuti pola yang sudah ada);
     animasi klien 120–260ms di bawah batas 700ms; tanpa audio, tanpa
     karakter manusia/hewan; "Aktivitas Berikutnya" satu-satunya aksi
     high-emphasis setelah jawaban benar (retry memakai secondary).

## Keputusan Phase 4 (lanjutan) — UI buat/ubah/arsip profil anak (2026-10-06)

Konteks: endpoint + validasi Phase 4 sudah DONE, tetapi tautan
`/parent/profil/baru` dan `/parent/profil/:id/edit` di dashboard **404** —
orang tua belum bisa membuat profil anak lewat UI, sehingga seluruh alur anak
tidak terjangkau tanpa API. PRD §8 menyebut "Parent creates child profile"
sebagai langkah 2–7 onboarding, jadi ini penyempurnaan Phase 4, bukan perilaku
baru.

1. **Satu komponen, dua rute**: `src/components/ChildProfileForm.astro` dengan
   `mode="create" | "edit"` dipakai `/parent/profil/baru` dan
   `/parent/profil/[id]/edit` — markup, gaya, dan skrip hanya satu salinan
   (pola `ParentAuthForm`).
2. **Isian = PRD §8 persis**: nickname (wajib, maks 40), usia select 3–7
   (wajib), avatar radio (opsional), bahasa, learning goals (maks 6 butir à
   40). Test `test/child-profile-ui.test.ts` **menolak** `type="date"`,
   `type="file"`, dan nama isian PII (nama lengkap/alamat/telepon/sekolah/
   foto) supaya daftar "Do not request" PRD §8 tidak dilanggar diam-diam.
3. **Katalog avatar** memakai kunci yang sama dengan kartu profil
   (`star`, `moon`, `book`, `lantern` — mengikuti daftar ilustrasi DESIGN.md);
   test membandingkan kedua katalog agar tidak menyimpang. OQ 15 tetap
   terbuka untuk validasi katalog di server.
4. **Kirim JSON ke endpoint yang sudah ada**: POST `/api/children` (buat) dan
   PATCH `/api/children/:id` (ubah) — seluruh validasi, gerbang kepemilikan
   3.7, dan cek Origin tetap di server; tidak ada jalur tulis baru.
   `age` dikirim sebagai number, `avatarKey: null` bila "Tanpa avatar",
   `learningGoals` hanya baris terisi.
5. **Umpan balik**: live region `role="status"` `aria-live="polite"`, sibuk =
   tombol nonaktif + "Menyimpan…", galat = pesan server di permukaan
   `error-note` (soft-peach + ink), sukses = `badge-success` (soft-green +
   deep-green). Mode buat → redirect `/parent`; mode edit → tetap di halaman
   dengan "Profil tersimpan." Status tidak pernah disampaikan lewat warna saja.
6. **Gerbang kepemilikan di halaman ubah**: `getChildForParent()` di frontmatter;
   id asing, id rusak, id tidak ada, dan profil terarsip → redirect `/parent`
   (hasil identik, anti-enumerasi 3.11); tanpa sesi → redirect `/login`.
7. **Arsip diperbaiki (4.10/4.11)**: kartu profil sebelumnya mengirim
   `POST` + `_method=DELETE` yang tidak pernah ditangani siapa pun (405).
   Kini `form[data-archive]` ditangkap skrip: **konfirmasi orang tua**
   (`window.confirm`) → `fetch DELETE` same-origin → reload; galat tampil di
   live region kartu. Sengaja tidak menambah method override di endpoint
   (lihat OQ 20).
8. **Anti-slop (DESIGN-SYSTEM §12)** — layar baru: `/parent/profil/baru` dan
   `/parent/profil/[id]/edit`. Diperiksa: hierarki (header → satu kartu form →
   satu tombol utama; "Tambah tujuan" tersier); dekorasi ~0 (tanpa gradien,
   blob, pill berlebih, tanpa `@keyframes` baru); sentuh target chip avatar
   44px, input 48px, tombol utama 52px; status tidak lewat warna saja; audio
   tidak ada; reduced motion lewat token `--dur-tap`/`--dur-*` (nol saat
   `prefers-reduced-motion`); **tanpa nilai hex hardcoded** di komponen (SVG
   memakai `currentColor` + `var(--c-*)`); QA E2E eksploratif di **390px
   (scrollWidth = 390, tanpa overflow)** dan **768px (753 ≤ 768)**, urutan Tab
   logis (skip link → nickname → usia → avatar → tujuan), empty state dashboard
   terlihat setelah profil diarsip. Lint: `npx -y @google/design.md lint
   DESIGN.md` → **0 error, 0 warning** (1 info: ringkasan token).
9. **Verifikasi**: `npm test` **151 passed** (9 baru di
   `test/child-profile-ui.test.ts`), `npx tsc --noEmit` bersih, `npm run build`
   hijau, `npm run smoke:auth` → **SMOKE_OK** (4 cek baru: form tambah 200,
   form ubah 200 + nilai awal, id asing → alihkan ke `/parent`, tautan dashboard;
   plus `/parent/profil/baru` tanpa sesi → 303 `/login`).
10. **Bukti lewat peramban (QA E2E eksploratif, server preview :4322)**:
    daftar akun → dashboard → tambah profil "Laras" (avatar bulan, 2 tujuan,
    tombol "Tambah tujuan" berfungsi) → kartu muncul → halaman ubah terisi
    penuh → ubah jadi "Laras Ayu" → "Profil tersimpan." → nickname duplikat
    di form tambah menampilkan pesan 409 berwarna soft-peach → arsip pindah
    ke "Profil Diarsipkan" dengan catatan retensi. Server preview dimatikan
    setelah QA; `astro preview` lama dari run sebelumnya (port 4321, menyajikan
    build basi → 500) ikut dibersihkan.

## Keputusan — konvensi payload aktivitas (CONTENT-SPEC §7, 2026-10-06)

Konteks: langkah aman antrean setelah OQ 16 (titik masuk baseline) menunggu
konfirmasi Arsyad. OQ 21 adalah prasyarat Phase 13 ("wajib didokumentasikan
sebelum menanam konten"), sehingga dikerjakan lebih dulu.

1. **CONTENT-SPEC kini punya bagian bernomor §7** ("Activity Payload
   Conventions"): §7.1 dua jalur pembentukan payload, §7.2 tabel penyimpanan
   per tipe (prompt / correct_answer / payload activity_option / jawaban
   anak), §7.3 aturan keras, §7.4 cek eksekusi. Nama "§7.13" pada catatan
   lama tidak pernah ada isinya — CONTENT-SPEC sebelumnya tanpa nomor bagian.
2. **MATCH hanya jalur 1** (objek `MatchData` utuh di `correct_answer`);
   jalur 2 sengaja `null` — pasangan tidak bisa ditebak dari skema. Tertulis
   eksplisit supaya penyusun konten tidak menaruh MATCH di `activity_option`.
3. **TRUE_FALSE kini hanya menerima boolean JSON (perbaikan perilaku kecil)**:
   `assembleFromOptions` dulu memaksa `Boolean(...)` sehingga `correct_answer`
   berupa teks `"false"` terbaca `true` — jawaban benar anak bisa dinilai
   salah diam-diam, dan aturan itu bertentangan dengan validator
   `validateActivityData` yang memang menuntut boolean. Kini salah tipe →
   `null` → layar "Aktivitas Belum Siap" (gagal aman VRD 6.14), bukan
   penilaian salah. Label kustom (`trueLabel`/`falseLabel`) hanya lewat jalur 1.
4. **Spesifikasi eksekusi**: `test/content-payload-conventions.test.ts`
   mengkodekan kedelapan fixture `activityTestFixtures` ke bentuk baris persis
   §7.2, membangun ulang (deep-equal), memeriksa `validateAnswer` benar+salah
   per tipe, kasus gagal aman (MATCH jalur 2, TRUE_FALSE non-boolean/prompt
   kosong, MULTIPLE_CHOICE tanpa pertanyaan, SEQUENCE bercelah, dua opsi
   benar), penolakan `colorValue` bukan-heks di renderer, dan test anti-drift
   yang membaca dokumen (tabel §7.2 wajib memuat kedelapan tipe).
5. **Tidak ada UI** di run ini → checklist layar dilewati (tanpa layar baru);
   `node <cache>/@google/design.md/dist/index.js lint DESIGN.md` tetap
   dijalankan: **0 error, 0 warning** (1 info).

## Keputusan Phase 9 — mesin progress (VRD 9.1–9.5, 2026-10-06)

Konteks: loop belajar utuh (Phase 7 lanjutan) dan OQ 21 selesai; antrean langkah
aman menunjuk mesin progress **tanpa UI**. Tidak ada layar baru di run ini.

1. **Modul baca murni** `src/lib/progress/engine.ts`:
   - **9.3 `getSkillAccuracy(db, childId, skillIds?)`** — fakta
     `attempts/correct` dari `learning_progress` + `accuracy = correct/attempts`
     yang **`null` bila belum ada percobaan** (9.7: persentase tidak dipaksa
     keluar dari data kosong). Skill yang diminta tapi belum punya baris tetap
     muncul dengan angka 0 + `accuracy: null`, supaya "tidak ada baris" tidak
     salah dibaca sebagai 100%. Hasil selalu urut `skillId` ASC → deterministik.
   - **9.4 `getRecentPerformance(db, childId, {window?})`** — N percobaan
     **terakhir yang sudah dinilai** (`is_correct IS NOT NULL`), terbaru dulu,
     lengkap dengan `accuracy` dan `errorsBySkill` (PRD §21: *error
     distribution by skill*). Jendela bawaan 10, rentang 1–50
     (`RECENT_WINDOW_DEFAULT` / `RECENT_WINDOW_MAX`); nilai di luar rentang →
     jendela bawaan, **bukan nol** — data kosong ditandai `accuracy: null`,
     bukan `window: 0`. Urutan `created_at DESC, id DESC` tetap deterministik
     walau dua baris ber waktu persis sama.
2. **Percobaan asesmen dasar ikut terhitung** di performa terkini: itu jawaban
   anak yang sah dan tersimpan di tabel yang sama; asesmen diperlakukan sebagai
   data belajar, bukan data kotor. Percobaan belum dinilai dikecualikan karena
   angka parsial menyesatkan.
3. **Otorisasi**: modul tidak punya akses sesi — pemanggil wajib melewati
   `getChildForParent()` (VRD 3.7) lebih dulu. Run ini **tidak mengekspos
   endpoint apa pun**; ringkasan siap-baca orang tua (9.8) menyusul dengan
   endpoint di prefix `/api/parent` yang sudah terproteksi middleware.
4. **9.1/9.2 diverifikasi lewat test, bukan ditulis ulang**: riwayat
   `activity_attempt` menumpuk (`attempt_no` 1..N) saat jawaban diulang di
   sesi berbeda, `learning_progress` cocok dengan riwayat, dan
   `getAreaProgress` (penyelesaian per area) memberi
   `{attempted, completed, total}` yang konsisten.
5. **9.5 deterministik + terisolasi**: dua panggilan identik → hasil identik;
   dua anak dengan keadaan sama → rekomendasi sama; progres anak A tidak bocor
   ke anak B; bila semua skill dikuasai → `null` (cabang yang sebelumnya tidak
   pernah tercapai kini ikut teruji).
6. **9.6 ditahan, bukan dilupakan**: tidak ada ambang mastery yang ditambahkan
   (VRD 9.6 menuntut bukti; bukti belum ada). Test memastikan `mastered_at`
   tetap `NULL` setelah 5 jawaban benar beruntun, dan `engine.ts` tidak memuat
   satu pun pernyataan tulis (`INSERT`/`UPDATE`/`DELETE`). Konsekuensi jujurnya
   tercatat di **OQ 23**: rekomendasi tidak pernah bergeser karena tidak ada
   skill yang pernah dianggap selesai.
7. **9.7**: keluaran murni angka + id — test memetakan JSON keluaran terhadap
   daftar kata terlarang (lulus/gagal/peringkat/…) dan menolak label apa pun.
8. **Anti-slop**: tidak ada UI di run ini → **checklist layar dilewati (tanpa
   layar baru)**, dilaporkan jujur. `npm run design:lint` tetap dijalankan:
   **0 error, 0 warning** (1 info: ringkasan token).
9. **Verifikasi**: `npm test` **176 pass / 0 fail** (6 baru di
   `test/phase9-progress-engine.test.ts`), `npx tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**.

## Keputusan Phase 9 (lanjutan) — ringkasan orang tua (VRD 9.8, 2026-10-06)

Konteks: mesin progres (9.1–9.5) sudah ada; langkah aman menunjuk **9.8
ringkasan siap-baca orang tua, tanpa UI** — baris datanya baru dirender
bersama Phase 10.1 (child overview).

1. **Modul agregasi murni** `src/lib/progress/summary.ts` —
   `getParentProgressSummary(db, child, {window?})` hanya mengagregasi fakta
   dari mesin yang sudah ada: `getSkillAccuracy` + `getRecentPerformance`
   (engine.ts), `getAreaProgress` (recommendation.ts), `getNextRecommendation`
   (9.5), `listLearningAreas` (Phase 5), dan hitungan sesi dari
   `learning_session`. Tidak ada ambang baru, tidak ada tulis (test
   memastikan sumbernya bebas `INSERT/UPDATE/DELETE`).
2. **Isi ringkasan** (PRD §12 dashboard orang tua):
   - `totals` — attempts/correct dari `SUM(learning_progress)`, `accuracy`
     `null` bila attempts 0, jumlah skill yang pernah dipraktikkan.
   - `areas[]` — enam learning area + `{attempted, completed, totalSkills}`
     per area (judul dari database, bukan hardcoded).
   - `skills[]` — akurasi per skill urut `skillId` (9.3).
   - `recent` — jendela performa terkini + `errorsBySkill` (PRD §21
     *error distribution by skill*); nilai `window` di luar 1..50 jatuh ke
     bawaan 10 di dalam engine, bukan ke nol.
   - `sessions` — `{completed, open, baseline, total, totalDurationMs,
     lastEndedAt}`; sesi asesmen dasar (`started_at = ended_at`) dihitung
     **terpisah** supaya penanda Phase 8 tidak tercampur durasi sesi belajar;
     `totalDurationMs`/`lastEndedAt` `null` bila belum ada sesi tertutup.
   - `lastPracticedAt`, `nextRecommendation` (saran latihan, PRD §12).
3. **Endpoint** `GET /api/parent/progress?child=<uuid>[&window=1..50]`
   (`src/pages/api/parent/progress.ts`) berada di prefiks `/api/parent` yang
   sudah dijaga middleware (VRD 3.5), lalu `parentIdOf()` (VRD 3.8) +
   `getChildForParent()` (VRD 3.7). Tanpa sesi → 401; `child` hilang → 400;
   id rusak/tidak ada/milik orang tua lain → **404 dengan badan identik**
   (diuji `deepEqual`). Profil **terarsip tetap bisa dibaca** — arsip
   menyembunyikan profil dari alur belajar, bukan merampas riwayat milik
   orang tua itu (keputusan eksplisit; bila Arsyad ingin sebaliknya, cukup
   tambah klausa `archived_at IS NULL`).
4. **Tanpa label (9.6/9.7)**: keluaran murni angka + id + waktu; test
   memindai seluruh JSON terhadap daftar kata terlarang (lulus/gagal/peringkat/
   leaderboard/…) dan memastikan `parentAccountId` tidak pernah keluar
   (`cache-control: no-store` bawaan `jsonResponse`).
5. **9.1/9.2/9.5 ikut teruji ulang lewat endpoint**: 6 jawaban (3 benar)
   → `totals.accuracy = 0.5`, sesi tertutup + sesi baseline = `{completed: 1,
   baseline: 1, total: 2}`, `nextRecommendation` menunjuk skill yang memang
   belum dikuasai.
6. **Anti-slop**: **checklist layar dilewati (tanpa layar baru)** — run ini
   hanya menambah modul data + endpoint JSON, tidak ada markup/layout/copy.
   `node <cache>/@google/design.md/dist/index.js lint DESIGN.md` tetap
   dijalankan: **0 error, 0 warning** (1 info: ringkasan token).
7. **Verifikasi**: `npm test` **182 pass / 0 fail** (6 baru di
   `test/parent-progress-summary.test.ts`), `npx tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` → `SMOKE_LOOP_OK`.

## Keputusan Phase 10 — child overview (VRD 10.1, 2026-10-06)

Konteks: mesin ringkasan 9.8 sudah ada tanpa UI; langkah aman menunjuk
**10.1 child overview** — layar pertama Phase 10, wajib lewat anti-slop.

1. **Rute `/parent/anak/[id]`** berada di prefiks `/parent` (terjaga
   middleware VRD 3.5), lalu `parentIdOf()` (3.8) + `getChildForParent()`
   (3.7). Id rusak/tidak ada/milik orang lain → redirect `/parent` dengan
   hasil identik (anti-enumerasi). Tanpa sesi → middleware sudah 303
   `/login` sebelum halaman jalan.
2. **Merender fakta, bukan menghitung ulang**: halaman hanya memanggil
   `getParentProgressSummary(db, child)` (VRD 9.8, murni baca). Tidak ada
   SQL, tidak ada ambang, tidak ada kata lulus/gagal/peringkat (9.6/9.7) —
   diuji `test/parent-child-overview.test.ts` (kode halaman dipisah dari
   komentar sebelum dipindai).
3. **Isi rendah density (PRD §12/§22, <30 detik)**: header (nama + usia +
   catatan arsip + "Terakhir berlatih") → satu panel `dl` berisi **tiga
   fakta** (Jawaban tersimpan + sub "n benar", Skill dipraktikkan + "di n
   dari 6 area", Sesi belajar + durasi total) → **satu** aksi utama "Buka
   layar belajar". Sesi terbuka ditandai teks ("Ada n sesi yang belum
   ditutup"), bukan warna. Bagian sesi/area/kekuatan/saran = VRD 10.2–10.5
   berikutnya, sengaja tidak ditanam sebagai header kosong.
4. **Durasi manusiawi**: `formatDuration` (detik → menit → jam); 0 ms
   tampil "kurang dari 1 detik" (bukan "0 detik" yang terbaca seperti bug).
5. **Empty state**: anak tanpa riwayat tidak melihat panel angka nol —
   muncul "Belum ada latihan" + "Mulai Belajar" (bukti E2E: anak kedua di
   smoke).
6. **Profil terarsip tetap bisa dibuka** (konsisten keputusan Phase 9
   lanjutan no. 3) dengan catatan arsip di halaman; tautan "Ringkasan"
   di kartu hanya untuk profil aktif supaya alur anak tetap jelas.
7. **Tautan dari dashboard**: `ChildProfileCard` mendapat aksi "Ringkasan"
   bergaya `.btn-link` (tautan teks berbeda dari tombol aksi) sehingga
   hierarki aksi tetap Pilih > Ringkasan/Ubah > Arsipkan; di ≤480px keempat
   aksi melebar penuh (diuji, tanpa overflow).
8. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — layar baru:
   hierarki tunggal (kembali → judul → panel fakta → satu aksi); dekorasi 0
   (tanpa gradien/blob/pill/@keyframes baru); touch target 44px terukur di
   390px; status selalu teks, bukan warna saja; nilai visual hanya token
   (test menolak hex hardcoded dan `var(--*)` yang tidak ada di
   `tokens.css`); animasi hanya transisi `--dur-tap` (0ms saat
   `prefers-reduced-motion`); tanpa audio, tanpa karakter; QA E2E
   eksploratif **390px scrollWidth=390 tanpa overflow** dan **768px = 768,
   3 kolom fakta**, urutan Tab: skip link → Kembali → Buka layar belajar.
   Lint `DESIGN.md` → **0 error, 0 warning** (1 info ringkasan token).
9. **Verifikasi**: `npm test` **187 pass / 0 fail** (5 baru di
   `test/parent-child-overview.test.ts`), `npx tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**
   (8 cek baru: tautan dashboard, 200 + nama, tiga fakta + aksi, angka dari
   riwayat nyata (2 jawaban/1 benar), tanpa kata lomba, id asing →
   `/parent`, anak kedua → empty state).

## Keputusan Phase 11 — activity editor (VRD 11.2–11.11, 2026-10-07)

- **Tiga layar baru**: `/reviewer/aktivitas` (daftar + saringan area/status +
  paginasi + keadaan kosong), `/reviewer/aktivitas/baru` (11.2 buat),
  `/reviewer/aktivitas/:id` (11.2 edit, isi terisi ulang dari payload). Semua
  berada di prefiks `/reviewer` (guard 11.1) dan tautan "Kelola aktivitas" di
  dashboard kini tidak lagi mengarah ke tautan mati.
- **Satu pintu validasi (11.4–11.10)**: `src/lib/activity/reviewer.ts` →
  `parseEditorPayload` dipakai bersama oleh POST dan PUT — prompt, tipe
  CONTENT-SPEC, usia 3–7, difficulty 1–3, `correct_answer` valid per tipe,
  `skill_id` wajib milik `learning_area_id` (`resolveSkillForArea`), asal konten
  dari enum, sumber maks 5 baris.
- **Payload = `ActivityData` utuh di `correct_answer`** (konsisten CONTENT-SPEC
  §7 / `buildActivityData`), dan baris `activity_option` diturunkan server oleh
  `deriveOptionRows` — pembaca (`isValidActivityData`) selalu mendapat baris
  opsi yang valid untuk kedelapan tipe; jalur "sumbat `activity_option`" tidak
  dipakai untuk konten baru.
- **Gerbang status (11.11, setengah bagian)**: editor menerima `DRAFT`,
  `FLAGGED`, `UNPUBLISHED` saja; status lain → 409 `REVIEW_STATUS_LOCKED`, jadi
  konten terbit tidak bisa disunting sambil melewati persetujuan. Layar
  menampilkan status sebagai teks (bukan warna saja). Transisi status
  (approve/reject/unpublish) masih menyusul.
- **Tidak ada catatan `content_review` saat sekadar menyimpan** (constraint
  `from_status ≠ to_status`) — jejak review hanya untuk transisi status.
- **Perbaikan gerbang 11.1**: `/reviewer/login` dan `/api/reviewer/auth/login`
  dikecualikan dari guard (`isReviewerPublicPath`) — sebelumnya halaman login
  redirect ke dirinya sendiri (303) dan endpoint login selalu 401
  `UNAUTHENTICATED`, artinya reviewer tidak bisa masuk sama sekali. Ditemukan
  lewat QA E2E run ini.
- **Rate limit tulis terpisah**: `REVIEWER_WRITE` 60/15 menit (env
  `RATE_LIMIT_REVIEWER_WRITE_MAX`) — login tetap 15.
- **Logika UI diuji**: penyusunan payload dipindah ke
  `src/lib/activity/editor-payload.ts` (fungsi murni, 11 test) sehingga skrip
  formulir hanya perekat DOM; garis merah anti-slop dipertahankan (token saja,
  tanpa heksa/durasi ms hardcoded, `prefers-reduced-motion`, badge status
  berlabel teks).
- **Verifikasi**: 216 test hijau, `tsc --noEmit` bersih, `npm run build` hijau,
  `npx -y @google/design.md lint DESIGN.md` **0 error / 0 warning**, QA E2E HTTP
  24/24 (gerbang sesi + login publik, 8 panel ter-render, buka→ubah→hapus,
  tautan area dashboard). ~~**Belum diuji di browser sungguhan**~~ →
  **SELESAI 2026-10-08**: kelima layar kini diuji di browser sungguhan
  (390px & 768px) — lihat "Keputusan — QA E2E eksploratif layar reviewer".
  (Catatan lama: server preview saat itu tidak terjangkau dari browser
  sesi QA, jadi cek 390px/tablet & reduced-motion baru sebatas pemeriksaan
  kode.)

## Keputusan Phase 11 (lanjutan) — transisi status review (VRD 11.11, 2026-10-07)

Konteks: editor + gerbang status sudah ada tetapi belum ada cara memindahkan
status — konten bisa disimpan sebagai draf tetapi tidak bisa dikirim review,
disetujui, diterbitkan, ditandai, atau ditarik. Run ini menutup **11.11**
sekaligus menjawab **OQ 4** (matriks transisi) dan memberi dasar **11.13**
(publish hanya dari approved state).

1. **Matriks = PRD §7 apa adanya**, di `src/lib/activity/review-flow.ts`
   (`REVIEW_TRANSITIONS`), sembilan pasang transisi:
   `DRAFT→HUMAN_REVIEW` (kirim review) · `HUMAN_REVIEW→QA_APPROVED` (setujui)
   dan `HUMAN_REVIEW→DRAFT` (minta revisi) · `QA_APPROVED→PUBLISHED` (terbit) ·
   `PUBLISHED→FLAGGED` (tandai masalah) dan `PUBLISHED→UNPUBLISHED` (tarik) ·
   `FLAGGED→HUMAN_REVIEW` / `FLAGGED→UNPUBLISHED` · `UNPUBLISHED→HUMAN_REVIEW`
   (ajukan ulang). **Tidak ada transisi lain** — khususnya tidak ada jalan
   menuju `PUBLISHED` selain dari `QA_APPROVED`, jadi VRD 11.13 berlaku tanpa
   aturan tambahan. Status yang sama (`from = to`) tidak pernah jadi transisi.
2. **Dijaga dua lapis**: (a) aplikasi menolak di luar matriks dengan
   `409 INVALID_TRANSITION` + daftar pilihan yang sah; (b) migrasi
   `0005_content_review_transitions.sql` memasang trigger BEFORE INSERT
   `content_review_check_transition` yang memvalidasi `from_status` terhadap
   `activity.review_status` yang sebenarnya **dan** terhadap matriks yang sama.
   Karena sinkronisasi status hanya terjadi lewat trigger AFTER INSERT
   (migrasi 0001), jalur tulis status di luar `content_review` tidak ada —
   "terbit tanpa lulus QA" mustahil dilakukan kode mana pun.
3. **Satu jalur tulis**: `POST /api/reviewer/aktivitas/:id/status`
   `{to_status, notes?}` — gerbang sesi middleware + `reviewerIdOf()` (VRD 3.8,
   sesi bukan body), cek Origin, rate limit `REVIEWER_WRITE`, catatan opsional
   maks 2000 karakter (mengikuti CHECK tabel). Penulisan memakai
   `INSERT … WHERE review_status = from` sehingga dua permintaan bersamaan
   tidak bisa melompati giliran — yang kalah mendapat `409 STATUS_CHANGED`.
   `reviewer` terisi dari sesi → `content_review.reviewer` + `activity.reviewed_by`
   (FK 0004) sehingga riwayat selalu punya nama.
4. **Riwayat provenance terbaca di layar**: `listReviewHistory()` (terbaru
   dulu, `LEFT JOIN reviewer_account` — baris tetap tampil bila akunnya
   terhapus) dirender sebagai `<ol>` di **panel baru `ReviewFlowPanel`** pada
   `/reviewer/aktivitas/:id`, dipasang **sebelum** formulir sehingga untuk
   status terkunci (HUMAN_REVIEW/QA_APPROVED/PUBLISHED) pengguna tetap punya
   jalan keluar — notice "Konten terkunci" kini menunjuk panel itu. `GET`
   detail ikut mengembalikan `history` untuk QA lewat HTTP.
5. **Jalur perbaikan konten terbit (OQ 24) terbukti jalan**:
   `PUBLISHED → UNPUBLISHED` → edit (terbuka kembali) → `→ HUMAN_REVIEW` →
   `→ QA_APPROVED` → `→ PUBLISHED`. Meloncat langsung ke `PUBLISHED` dari
   `HUMAN_REVIEW`/`FLAGGED` ditolak di setiap percobaan.
6. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — satu layar baru
   berubah (`ReviewFlowPanel` + integrasi di layar detail): hierarki tunggal
   (status sekarang → langkah → riwayat); satu aksi high-emphasis per layar
   (langkah maju `primary`, mundur/tunda `secondary`); tanpa gradien/blob/pill,
   tanpa `@keyframes`/transisi sama sekali (QA browser: 0 animasi →
   `prefers-reduced-motion` otomatis terpenuhi); status selalu teks, bukan
   warna; nilai visual hanya token (uji: 0 hex hardcoded, 0 durasi ms);
   sentuh target terukur di browser **390px: scrollWidth 390, semua target
   ≥44px (tombol 67px, textarea 68px), 0 elemen melewati viewport**; kontras
   `.history-meta` sengaja `--c-ink` (bukan `--c-muted-ink` yang di atas
   ivory hanya 4,45:1 — pola OQ 10 tidak ditambah); tanpa audio, tanpa
   karakter. `npx -y @google/design.md lint DESIGN.md` → **0 error, 0 warning**
   (1 info ringkasan token).
7. **Verifikasi**: `npm test` **228 pass / 0 fail** (12 baru di
   `test/review-flow.test.ts`: matriks persis §7, penolakan lompatan, trigger
   DB, sinkronisasi + jejak, endpoint 401/403/400/409, alur penuh, jalur
   perbaikan konten terbit, riwayat di GET, berkas UI), `tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**.
8. **Smoke E2E baru `npm run smoke:reviewer`** (`scripts/smoke-reviewer.mjs`,
   port 4401, DB segar, login reviewer sungguhan lewat HTTP) →
   **SMOKE_REVIEWER_OK** (22 cek): gerbang sesi 303/401, login, buat draf,
   tolak `DRAFT→PUBLISHED` dan `HUMAN_REVIEW→PUBLISHED` (409), alur penuh
   sampai terbit, riwayat 3 baris bernama, edit terkunci saat terbit, jalur
   tarik→edit→ajukan ulang→terbit, catatan >2000 → 400, lintas-asal → 403,
   layar detail memuat panel + riwayat.
9. **QA E2E eksploratif di browser sungguhan** (server :4402, sesi reviewer
   dibuat langsung di DB — jalur login UI diuji oleh smoke, tanpa mengetik
   kata sandi di peramban): klik "Kirim untuk review" → reload → status
   "Menunggu review" + baris riwayat "Draf → Menunggu review … oleh Peninjau
   QA"; klik "Setujui" → "Lulus QA" + notice "Konten terkunci" muncul + satu
   tombol "Terbitkan"; fokus keyboard bekerja; 390px tanpa overflow;
   0 animasi di seluruh halaman.
10. **Tidak dikerjakan**: 11.12 (preview sebagai anak) dan 11.14 (uji feed
    anak) — tetap antrean berikutnya; 11.13 sudah dijaga matriks tetapi
    tidak ada test feed anak yang menolak konten non-PUBLISHED selain query
    `listPublished*` yang sudah difilter (dicek di Phase 7/8).

## Keputusan Phase 11 — pratinjau sebagai anak (VRD 11.12, 2026-10-07)

1. **Satu perender, dua layar**: `/reviewer/aktivitas/:id/pratinjau` memanggil
   `renderActivity` + `buildActivityData` dengan input persis seperti
   `/learn/aktivitas/:id` (acceptance: *preview matches production renderer*).
   Test membuktikannya dua arah: markup hasil jalur pratinjau == markup jalur
   `getPublishedActivityById` (assertion identik string), dan daftar kunci
   objek input kedua halaman dibandingkan ekuivalen.
2. **Tanpa data anak**: pratinjau tidak membuka `learning_session`, tidak
   menulis `activity_attempt`/`learning_progress`. Jawaban dinilai
   `POST /api/reviewer/aktivitas/:id/preview` yang memakai `validateAnswer`
   yang sama lalu hanya membalas `{preview, correct, explanation, hint?}` —
   nol baris tabel anak terverifikasi sebelum/sesudah (test). Body pratinjau
   sengaja tidak membawa `childId`/`sessionId`.
3. **Runtime dipakai bersama** (`public/activity/runtime.js`): baca
   `cfg.preview` → penilaian diarahkan ke endpoint pratinjau, `leaveSession`
   tidak memanggil `/api/session/complete` (tidak ada sesi), tombol Beranda
   memakai `cfg.homeUrl`. Karena satu runtime, alur umpan balik/retry/next di
   pratinjau identik produksi — termasuk pesan gagal jaringan yang jujur.
4. **Usia pratinjau**: `?usia=` dibatasi rentang `target_age_min..max`
   (yang memang bisa dilihat anak); di luar rentang → jatuh ke usia minimal.
   Status aktivitas ikut ditampilkan sebagai **teks**, bukan warna.
5. **Status apa pun bisa dipreview** (termasuk DRAFT) selama payload bisa
   dirakit; gagal dirakit → keadaan "Isi belum bisa dirakit" (VRD 6.14), tanpa
   menebak isi. Feed anak tetap hanya PUBLISHED (dibuktikan di test + query
   `getPublishedActivityById`).
6. **Anti-slop**: layar baru → checklist DESIGN-SYSTEM §12 dijalankan
   (hierarki: header → catatan "tidak disimpan" → pilih usia → aktivitas;
   tanpa gradien/blob/pill/kartu seragam; sentuh target `--touch-min` ≥44px;
   status usia lewat teks + `aria-current`; ada keadaan 404 & gagal dirakit;
   audio OFF; nilai visual hanya token — test 0 hex, 0 durasi ms).
   `@google/design.md lint DESIGN.md` → **0 error, 0 warning** (1 info).
7. **Verifikasi**: `npm test` **238 pass / 0 fail** (10 baru di
   `test/preview-11-12.test.ts`), `tsc --noEmit` bersih, `npm run build`
   hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**, dan
   `node scripts/smoke-reviewer.mjs` → **SMOKE_REVIEWER_OK** (kini juga
   mengecek gerbang 303/401 pratinjau, halaman DRAFT 200, fallback usia,
   penilaian benar/salah tanpa `attemptId`, lintas-asal 403, tautan
   `/pratinjau` di layar detail).

## Keputusan Phase 10 (lanjutan) — kekuatan & saran latihan (VRD 10.4–10.5, 2026-10-07)

Konteks: 10.4/10.5 sebenarnya sudah dikomit 2026-10-06 (`130506b`,
`d31c1ff`) tetapi belum diverifikasi dan meninggalkan cacat kualitas; run ini
menutupnya.

1. **Cacat yang diperbaiki — UUID bocor ke orang tua**: bagian Kekuatan
   merender `skill.skillId` (UUID dari `learning_progress.skill_id`) sebagai
   judul skill, dan mencari judul area lewat `skillId.split("-")[0]` yang
   mustahil cocok (`areaId` juga UUID) sehingga jatuh balik ke UUID. Kini
   modul baru `src/lib/progress/strengths.ts` (`pickStrengths`,
   `buildSkillLabels`, `getSkillLabel`) menerjemahkan UUID → judul skill +
   judul area dari `listAllSkillsWithArea`; skill yang hilang jatuh ke
   `Nama skill tidak tersedia`, bukan UUID.
2. **Seleksi kekuatan pindah ke modul murni**: filter `attempts > 0`, urut
   akurasi → jumlah percobaan → skillId (tiebreak eksplisit, deterministik),
   limit 3 (dibatasi 1..5; di luar rentang jatuh ke bawaan), masukan tidak
   diurutkan di tempat. **Tanpa ambang** — OQ 23 tetap menunggu bukti.
3. **Bukti, bukan klaim**: tiap baris kini memuat `n jawaban` + pil
   `X% benar` dengan `aria-label` lengkap, dan catatan menyebut "makin banyak
   percobaan, makin bisa diandalkan" — orang tua bisa menilai kepercayaan
   angka; status tidak disampaikan lewat warna saja.
4. **Saran latihan (10.5) dirapikan**: tipe/tingkat memakai
   `getActivityTypeLabel` + `getDifficultyLabel` yang sudah ada (bukan enum
   `TAP_ANSWER` + deret bintang), dan kini punya **empty state** saat
   `nextRecommendation` `null` ("Belum ada aktivitas terbit…") — tidak ada
   layar buntu. Tautan "Mulai Aktivitas Ini" menujuk `/learn/aktivitas/:id`
   yang memang ada.
5. **Anti-slop**: satu aksi utama per bagian, tanpa elemen dekoratif baru,
   token desain saja (tes 0 hex), sentuh `--touch-min`, empty state untuk
   kedua bagian, animasi tidak ditambah (musik OFF, `.reduce-motion` tetap),
   tanpa karakter/kompetisi. `npx -y @google/design.md lint DESIGN.md` →
   **0 error, 0 warning** (1 info token-summary).
6. **Verifikasi**: `npm test` **248 pass / 0 fail** (6 baru di
   `test/parent-strengths-suggestion.test.ts`), `tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**
   (+2 cek: judul skill tampil **dan** UUID skill tidak bocor; saran tampil
   tanpa enum mentah), `node scripts/smoke-reviewer.mjs` → **SMOKE_REVIEWER_OK**.

## Keputusan Phase 12 — skema draf & impor batch (VRD 12.1, 12.3–12.6, 2026-10-07)

Konteks: Phase 11 ✅, sisa fase parsial tertahan keputusan produk; langkah
aman berikutnya (tertulis di run sebelumnya) = membangun skema + validasi +
gerbang review **tanpa menebak provider** (OQ 26).

## Keputusan Phase 14 (VRD 14.4–14.7) — Audit gerak & audio (2026-10-07, run ini)

Audit murni-verifikasi (tanpa perubahan kode) untuk memastikan:

1. **Musik OFF by default (14.4)** — `BaseLayout.astro` mendefinisikan
   `MUSIC_OFF_DEFAULT = { music: false, sfx: true, voice: true }`; preferensi
   tersimpan di `localStorage` via `eduAudio.get/set`. Halaman aktivitas anak
   (`/learn/aktivitas/[id]`, pratinjau reviewer) meneruskan `audioEnabled: false`
   ke renderer. **Lolos.** (Catatan: 14.1–14.3 mute/SFX/suara suara tetap
   tertahan OQ 18 + OQ 5 — tidak dibangun, hanya diverifikasi tidak ada audio
   yang aktif diam-diam.)

2. **Budget animasi 120–700ms (14.5, 14.6)** — Token di `tokens.css`:
   `--dur-tap: 150ms`, `--dur-card: 240ms`, `--dur-page: 280ms`,
   `--dur-success: 500ms` — semuanya dalam rentang. **Seluruh transisi di
   codebase memakai token ini** (tidak ada durasi `ms` hardcoded). Satu-satunya
   `@keyframes` adalah `slideUp` pada banner offline (`/learn.astro`),
   mengikuti `var(--dur-card)` = 240ms. **Tidak ada animasi continuous/infinite,
   tidak ada spinner/loading berputar, tidak ada gerak dekoratif.** Lolos.

3. **`prefers-reduced-motion` benar-benar mematikan gerak non-esensial (14.6)** —
   `tokens.css` `@media (prefers-reduced-motion: reduce)` memaksa
   `--dur-* = 0ms` + `animation-duration: 0.01ms !important` +
   `transition-duration: 0.01ms !important` secara global. Banyak komponen
   (`learn.astro`, `reviewer/aktivitas/index.astro`, `reviewer/aktivitas/impor.astro`,
   `ActivityEditorForm.astro`, `ReviewFlowPanel` — 0 animasi) ikut menonaktifkan
   transisi eksplisit via `.reduce-motion`. **Lolos.**

4. **Anti-slop (DESIGN-SYSTEM §12)** — Run ini tidak menambah layar baru →
   checklist dilewati jujur. `npx -y @google/design.md lint DESIGN.md` → **0 error,
   0 warning** (1 info token-summary).

5. **Verifikasi regresi** — `npm test` 258 passed, `tsc --noEmit` bersih,
   `npm run build` hijau, `design:lint` 0 error, `smoke-loop.mjs` →
   `SMOKE_LOOP_OK`, `smoke-reviewer.mjs` → `SMOKE_REVIEWER_OK`.

**Status VRD 14.4–14.7: ✅ DONE** (audit selesai, tanpa temuan).
Langkah berikutnya: **Phase 15 (Privacy & Child Safety Review, 15.1–15.10)** —
juga verifikasi, bukan pembangunan fitur.

1. **Skema satu pintu (12.1)**: `src/lib/activity/ai-draft.ts` +
   `docs/AI-DRAFT-SCHEMA.md`. Amplop `{schema_version: 1, model?,
   prompt_version?, drafts: [1..25]}`; tiap draf memakai field snake_case
   persis editor (CONTENT-SPEC §7) tetapi lokasi memakai **`area_code` +
   `skill_code`, bukan UUID** — generator di luar aplikasi tidak tahu UUID,
   keduanya diambil dari seed migrasi 0003. Dokumen itu juga memuat templat
   prompt siap tempel (12.1) dan contoh batch.
2. **Dua lapis validasi (12.3/12.4)**: `parseDraftBatch` (murni, jadi
   pesan galat bernomor `Draf ke-N: …` bisa diuji) → endpoint lalu
   memvalidasi ulang tiap draf lewat `parseEditorPayload` (satu pintu
   validasi editor, VRD 11.2) + `resolveSkillForArea`. **Semua validasi
   selesai sebelum satu baris pun ditulis** — bila satu draf gagal, batch
   utuh ditolak (`400 DRAFT_BATCH_INVALID`); tidak ada batch setengah jadi.
3. **Penandaan tak bisa dipalsukan (12.5)**: `toEditorBody()` selalu
   menulis `content_origin = 'AI_DRAFT'`; field `content_origin` dari draf
   tidak pernah dibaca sama sekali, jadi impor tidak bisa dipakai
   me-launder konten AI sebagai `HUMAN_CREATED`. Diuji langsung
   (`test/phase12-ai-draft.test.ts`).
4. **Masuk antrean review, bukan tayang (12.6)**: endpoint
   `POST /api/reviewer/aktivitas/import` (balik guard reviewer + cek Origin
   + rate limit `REVIEWER_WRITE` + body maks 512 KB) menyimpan batch sebagai
   `review_status = 'DRAFT'` — transisi status tetap hanya lewat matriks
   PRD §7 (VRD 11.11/11.13), dan feed anak menyaring `PUBLISHED`
   (VRD 11.14) sehingga draf impor tak pernah terlihat anak. Endpoint ini
   bukan "jalur generate": ia menerima batch JSON dari sumber mana pun.
5. **UI impor (12.6)**: halaman `/reviewer/aktivitas/impor` (tempel JSON/
   unggah file, validasi client-side, status via live region, redirect ke
   daftar pas sukses) + tautan dari dashboard reviewer & daftar aktivitas.
6. **Resolusi kode di-cache per batch** (Map per area/skill) supaya 25 draf
   dengan area sama tidak memicu query ganda; kode tak dikenal = penolakan,
   bukan fallback diam-diam ke area lain.
7. **Skipped / tertahan**: VRD 12.2 (generate batch) tetap menunggu OQ 26 —
   sengaja tidak ada satu pun pemanggil API model di repo. VRD 12.7–12.13
   adalah langkah pemeriksaan manusia per aktivitas; kerangkanya sudah ada
   (checklist per aktivitas di CONTENT-SPEC + antrean status Phase 11), jadi
   tidak dibangun ulang. 12.14 sudah dijaga matriks + trigger (11.13);
   12.15 memakai kolom `activity.version` yang sudah `+1` saat edit.
8. **Anti-slop**: `npx -y @google/design.md lint DESIGN.md` dijalankan:
   **0 error** (1 info). Nilai visual hanya lewat token; prefers-reduced-motion
   dihormati; touch target ≥44px; status via teks + aria-live; tanpa
   gradien/audio/ilustrasi dekoratif.
9. **Test**: `test/phase12-ai-draft.test.ts` (10 test) — amplop batch, 10
   kasus draf rusak bernomor, 8 tipe aktivitas lolos skema, penandaan
   dipaksa, endpoint suka/gagal/gerbang, dan "tidak ada tulis saat batch
   ditolak". Total suite: **258 passed** (sebelumnya 248).

## Keputusan Phase 18 — performa (VRD 18.1–18.8, 2026-10-07)

Konteks: seluruh fase tersisa tertahan keputusan produk; Phase 18 adalah
verifikasi terukur terakhir yang tidak butuh keputusan baru. Semua angka di
bawah diukur, bukan ditebak.

1. **Alat ukur tetap ada, bukan sesi sekali pakai**: `npm run perf`
   (`scripts/perf-measure.mjs`) mengukur terhadap server hasil `npm run build`
   + database segar (pola smoke): TTFB median 5× per halaman, berat halaman
   (HTML + aset referensi), bundel klien, header cache aset, dan latensi
   `POST /api/activity/attempt`. Ambang di dalam skrip: TTFB < 500 ms,
   berat halaman anak < 300 KB, aset ber-hashed wajib `Cache-Control`
   public + max-age, latensi attempt < 500 ms. Keluaran: **PERF_OK**.
2. **18.1 Muat awal (lokal)**: beranda TTFB 5 ms (HTML 5,4 KB) · login 6 ms
   (7,6 KB) · child home 66 ms pertama / 7 KB berikutnya (total 19,5 KB) ·
   halaman area 7 ms (8,1 KB) · layar aktivitas 8 ms (HTML 8,4 KB + aset
   17 KB = 25,4 KB). Interaksi anak pertama tidak menunggu apa pun selain
   HTML + 1 CSS — tidak ada font eksternal, tidak ada pihak ketiga.
3. **18.2 Gambar**: tidak ada satu pun gambar di `public/` (9 file, 16,7 KB,
   semuanya JS modul aktivitas) maupun di `src/` — jadi tidak ada media yang
   bisa memblokir interaksi pertama, dan tidak ada yang perlu dikompresi.
4. **18.3 Lazy-load**: terpenuhi desain — perender type-driven hanya
   merender `<script type="module">` yang mengimpor **satu** modul tipe
   (`tap-answer.js`, dll., masing-masing < 3 KB); bukti dari browser:
   layar aktivitas TAP_ANSWER memuat tepat 3 berkas
   (`renderer.css`, `tap-answer.js`, `runtime.js`).
5. **18.4 Bundel**: `dist/client` = 19 file, 86,9 KB mentah (~27,8 KB gzip
   estimasi 0,32) — jauh di bawah anggaran 512 KB. Server-side rendering
   membuat sebagian besar halaman murni HTML.
6. **18.5 Cache**: aset ber-hashed `/_astro/*` → `public, max-age=31536000,
   immutable` ✅. **`/activity/runtime.js` (nama tetap) → `max-age=0` +
   ETag tetapi adapter tidak menjawab 304** untuk `If-None-Match`, jadi
   diunduh ulang penuh (8,5 KB) tiap kunjungan layar aktivitas. Header file
   `public/` diatur adapter Astro **sebelum** middleware aplikasi, jadi tidak
   bisa diubah dari kode aplikasi tanpa memindahkan berkas ke rute SSR
   (keputusan arsitektur kecil → **OQ 27**). Dampak nyata kecil (8,5 KB),
   sengaja tidak ditambal diam-diam.
7. **18.6 Transisi aktivitas**: server median 20 ms (17–36 ms) untuk 5×
   POST attempt; di browser sungguhan klik jawaban → feedback "✓ Benar!"
   tampil dalam **76 ms**. Jauh di bawah ambang 500 ms.
8. **18.7 Memori (proxy, jujur)**: QA E2E eksploratif memakai browser sesi
   (bukan perangkat rendah sungguhan). Tercatat: JS heap ~9,5 MB stabil
   (tidak naik antar navigasi), DOM 48–89 elemen per halaman anak. Ini
   **bukti ringan-hati, bukan** bukti di HP kelas bawah — pengukuran
   perangkat nyata butuh perangkat fisik (tidak tersedia di cron).
9. **18.8 Tablet**: viewport 768px — child home, layar aktivitas, dan
   dashboard orang tua semuanya `scrollWidth == 768` (tanpa overflow),
   load 25–61 ms, DOM ringan. Gate 390px juga lolos (scrollWidth 390).
10. **Anti-slop**: tidak ada layar baru di run ini → **checklist layar
    dilewati (tanpa layar baru)**; `npx -y @google/design.md lint DESIGN.md`
    tetap dijalankan → **0 error, 0 warning**.
11. **Verifikasi**: `npm test` 258 pass, `tsc --noEmit` bersih,
    `npm run build` hijau, `npm run perf` → **PERF_OK**,
    `smoke-loop`/`smoke-reviewer` tetap hijau.

## Keputusan — OQ 10: kontras `--c-muted-ink` (penutup Phase 17, 2026-10-08)

Konteks: Phase 17 sudah DONE tetapi OQ 10 (kontras teks sekunder) tidak ikut
dikerjakan, padahal OQ 10 sendiri menugaskannya ke Phase 17. Run ini
menutupnya sebagai langkah atomik.

1. **Nilai baru `#5C665E`, bukan `#687269` seperti saran lama.** Hitungan
   menunjukkan `#687269` hanya menaikkan kontras di ivory (4,77) — di atas
   permukaan bertint tetap gagal: soft-green 4,12 dan soft-peach 3,82.
   Kombinasi itu nyata: `.feedback-hint` (teks petunjuk layar aktivitas anak,
   `--fs-sm`) memakai `--c-muted-ink` di dalam `.activity-feedback` yang
   berlatar `soft-green` (benar) / `soft-peach` (belum tepat). `#5C665E`
   dipilih sebagai nilai paling terang yang lolos ≥4,5:1 di **semua**
   permukaan tempat token itu benar-benar dipakai: ivory 5,70 · warm-white
   5,83 · soft-green 4,91 · soft-peach 4,56 · soft-blue 4,88 · putih 5,97.
2. **Latar berwarna lain tidak perlu ditangani** karena teks di atasnya
   memang bukan muted-ink: badge `warm-yellow`, `coming-soon` `soft-blue`,
   tombol tertertiar `sage`, status error `soft-peach`, status ok
   `soft-green` semuanya memakai `--c-ink` / `--c-deep-green` (dicek satu
   per satu di seluruh `src/`). Satu-satunya pengecualian lama,
   `.history-meta` di `ReviewFlowPanel`, sengaja tetap `--c-ink`.
3. **Spesifikasi jujur setelah perubahan**: DESIGN.md dulu menulis "muted
   ink is only used at 14px+ on warm white" — kenyataannya dipakai juga di
   ivory, di soft-green/soft-peach, dan turun ke `--fs-xs` (`.not-started`,
   `.activity-area`). Kalimat diganti agar menyebut permukaan yang benar;
   dengan kontras 4,56:1 ke atas, pemakaian 12px pun tetap lolos AA.
4. **Test sebagai gerbang** — `test/color-contrast.test.ts` (4 test):
   muted-ink ≥4,5:1 ke atas keempat permukaan, `--c-ink` ≥4,5:1 di
   ivory/warm-white, mirror DESIGN.md ↔ tokens.css untuk token ini, dan
   penolakan nilai lama `#6C776F` masih bersembunyi di berkas mana pun.
5. **Bukti di peramban sungguhan** (QA E2E eksploratif, server hasil build
   :4323): beranda `.sub` muted-ink di atas ivory → **5,70:1**; halaman
   login `.intro` di atas warm-white → **5,83:1** (dihitung dari computed
   style + rantai latar efektif, bukan dari harapan).
6. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — tanpa layar baru,
   jadi checklist per-layar dijalankan untuk permukaan yang tersentuh:
   hierarki & jumlah dekorasi tidak berubah (hanya nilai warna via token);
   sentuh target, usia, kepercayaan orang tua, audio (OFF), reduced-motion
   tidak tersentuh — perubahan murni warna teks; QA 390px tidak berubah
   (tidak ada layout/box model yang disentuh); status tetap teks, bukan
   warna. `node …/@google/design.md/dist/index.js lint DESIGN.md` →
   **0 error, 0 warning** (1 info token-summary).
7. **Verifikasi**: `npm test` **262 pass / 0 fail** (4 baru), `tsc --noEmit`
   bersih, `npm run build` hijau, `npm run perf` → **PERF_OK**,
   `smoke-loop` → **SMOKE_LOOP_OK**, `smoke-reviewer` → **SMOKE_REVIEWER_OK**.

## Keputusan — QA E2E eksploratif layar reviewer (2026-10-08)

Konteks: catatan Phase 11 masih berbunyi *"**Belum diuji di browser sungguhan**
— cek 390px/tablet & reduced-motion baru sebatas pemeriksaan kode"* untuk
layar daftar/buat/edit/impor/pratinjau. Run ini menutup celah itu sebagai
langkah verifikasi (VRD 16.10/16.11 viewport + 17.1/17.13 tinjauan visual),
tanpa keputusan produk baru.

1. **Alat ukur tetap, bukan sesi sekali pakai**: `scripts/qa-server.mjs`
   (`npm run build && node scripts/qa-server.mjs`) menyalakan server hasil
   build + database segar (`.data/qa-server-pglite`), menanam akun reviewer
   fixture (nama samaran, localhost) + dua aktivitas (satu `DRAFT`, satu
   `PUBLISHED` lewat matriks PRD §7), lalu mencetak baris
   `QA_SERVER_READY` (port, cookie sesi, id aktivitas) dan tetap hidup
   sampai dihentikan. Berbeda dari smoke: skrip ini tidak mengakhiri
   server, jadi peramban QA bisa membuka banyak layar berturut-turut.
2. **Metode**: cookie sesi dipasang lewat CDP `Network.setCookie` — kata
   sandi tidak pernah diketik di peramban. Tiap layar dicek di **390px &
   768px**: `scrollWidth`, elemen yang melewati viewport, target sentuh
   (tinggi label dipakai sebagai target efektif untuk radio 20×20),
   `document.getAnimations()`, urutan Tab, teks status, dan empty state;
   `prefers-reduced-motion` diemulasi lewat `Emulation.setEmulatedMedia`.
3. **Hasil yang lolos sebelum perbaikan**: kelima layar `scrollWidth` =
   lebar viewport (390/768), **0 elemen melewati viewport** (skip-link
   off-screen by design), **0 animasi** di kelima layar, reduced-motion →
   durasi 0,01ms, status selalu berteks ("Draf"/"Terbit" — bukan warna
   saja), empty state saringan kosong ada ("0 aktivitas" + h2), urutan Tab
   logis (skip link → saringan → aksi → daftar), tombol ikon pratinjau
   punya `aria-label`, dan alur pratinjau utuh di browser: klik jawaban →
   `POST .../preview` → "✓ Benar!" + penjelasan + "Aktivitas Berikutnya" →
   kembali ke detail.
4. **Tiga temuan yang diperbaiki** (melanggar DESIGN.md *"button-primary =
   satu-satunya aksi high-emphasis per layar"* dan target sentuh ≥44px):
   - **Daftar aktivitas**: dua `btn-primary` ("+ Buat Aktivitas Baru" +
     "Impor Draf AI") → impor jadi `btn-secondary` (jalur pendukung).
   - **Layar edit**: "Kirim untuk review" (panel) bersaing dengan "Simpan
     Perubahan" (formulir). Kini panel: maju = `btn-secondary`, mundur =
     `btn-tertiary` (baru: transparan + garis bawah, tinggi 65px), dan
     `Simpan Perubahan` = satu-satunya primary. **Alasan**: transisi sukses
     memanggil `window.location.reload()` sehingga edit yang belum
     disimpan hilang — aksi simpan yang harus menonjol. Keputusan lama
     "langkah maju `primary`, mundur `secondary`" (Keputusan Phase 11
     lanjutan no. 1) resmi digantikan di sini; gaya `.btn-primary` yang
     tak terpakai dibuang dari panel.
   - **Skip-link** (semua layar): 224×40 → `min-height: var(--touch-min)` =
     224×44.
5. **Gerbang regresi baru** `test/anti-slop-action-hierarchy.test.ts`
   (4 test): daftar maksimal satu `btn-primary` + impor bertanda sekunder,
   panel tanpa `btn-primary` dengan cabang kelas maju/mundur, tombol simpan
   tetap primary, skip-link `min-height: var(--touch-min)`; panel juga
   tetap bebas heksa/durasi ms.
6. **Temuan yang TIDAK diperbaiki** (dicatat, bukan ditambal diam-diam):
   - `/parent/anak/:id` juga memuat dua `btn-primary` → **OQ 28**
     (pilihan penekanan produk + butuh sesi orang tua di QA server).
   - Transisi status memuat ulang halaman sehingga edit tersimpan yang
     belum dikirim hilang → **OQ 29** (guard produk, perilaku baru).
   - Untuk status terkunci (HUMAN_REVIEW/QA_APPROVED/PUBLISHED) layar
     kini **tanpa `btn-primary` sama sekali** — layar berfungsi
     informatif, aksi maju tetap tombol berbingkai & aksi mundur
     berteks-bergaris. Bila dikehendaki aksi maju kembali primary saat
     terkunci, cukup kembalikan satu cabang kelas (tidak ada perubahan
     perilaku).
   - Tautan teks inline di teks bantuan (mis. "contoh batch") 16px tinggi
     — dikecualikan WCAG 2.5.8 karena inline dalam kalimat.
7. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — tiga berkas UI
   berubah (daftar, panel, layout): hierarki kini tepat satu aksi primary
   per layar reviewer; dekorasi tidak bertambah (0 `@keyframes` baru, 0
   animasi terukur di 390px & 768px); target sentuh semua ≥44px pada kedua
   viewport (radio 20×20 berpasangan label 44px); status tetap teks +
   live region `aria-live`; nilai visual hanya token (panel bebas heksa &
   durasi ms, diuji tes); tanpa audio; `prefers-reduced-motion` → 0,01ms.
   `node @google/design.md lint DESIGN.md` → **0 error, 0 warning**
   (1 info token-summary).
8. **Verifikasi**: `npm test` **266 pass / 0 fail** (4 baru), `tsc --noEmit`
   bersih, `npm run build` hijau, `node scripts/smoke-loop.mjs` →
   **SMOKE_LOOP_OK**, `node scripts/smoke-reviewer.mjs` →
   **SMOKE_REVIEWER_OK**, `npm run perf` → **PERF_OK**; QA browser ulang
   pasca-perbaikan: daftar & edit tepat 1 primary, 0 overflow, 0 animasi di
   390px & 768px; halaman publik (beranda, login reviewer) tak berubah
   selain skip-link 44px.

## Keputusan — QA E2E eksploratif layar orang tua + penutupan OQ 28 (2026-10-08)

Konteks: langkah yang tercatat pada run sebelumnya — perbaikan hierarki
aksi ganda di `/parent/anak/:id` (OQ 28) dibuktikan di peramban memakai
`scripts/qa-server.mjs` yang diperluas.

1. **QA server kini menanam fikstur orang tua lewat API sungguhan**:
   register akun orang tua (nama samaran, hanya localhost) → dua profil
   anak ("Rania" berisi riwayat, "Dimas" kosong untuk empty state) → dua
   sesi belajar pada aktivitas PUBLISHED (3 jawaban: 2 benar, 1 salah)
   ditutup lewat `/api/session/complete`. Cookie sesi orang tua, `childId`,
   dan `emptyChildId` dicetak di baris `QA_SERVER_READY` sehingga peramban
   QA memakai sesi sungguhan **tanpa mengetik kata sandi**. Jar cookie
   dipisah per peran (reviewer / orang tua) lewat pabrik `callerFor()`.
2. **OQ 28 ditutup — "Buka layar belajar" turun ke `btn-secondary`**
   (warm-yellow + teks `--c-ink`, 10,52:1), sesuai
   rekomendasi yang tertulis: "Mulai Aktivitas Ini" (PRD §12 *what to
   practice next*) tetap satu-satunya aksi high-emphasis layar. Empty state
   "Mulai Belajar" tetap primary di cabang `hasData` yang berbeda — keduanya
   tidak pernah tampil bersamaan, jadi layar selalu tepat satu primary.
3. **Temuan kedua saat QA: hover `btn-secondary` kartu profil memakai
   latar `--c-warning` → teks `--c-ink` hanya 4,43:1 (gagal AA 4,5:1)**.
   Baik di kartu profil maupun di ringkasan anak, hover kini memakai
   cincin inset `--c-ink` (token-only; teksnya tetap 10,52:1). Tidak ada
   pasangan teks–latar yang lolos 4,5:1 di atas warning, jadi warning tetap
   untuk dot/ikon/fill sesuai DESIGN.md.
4. **Bukti browser (QA E2E eksploratif, server hasil build :4404, sesi
   dipasang via CDP `Network.setCookie`)** — ketiga layar (`/parent`,
   ringkasan berdata, ringkasan kosong) pada **390px & 768px**:
   `scrollWidth` = viewport, **0 elemen melewati viewport**, **0 animasi**,
   target sentuh ≥44px (semua tombol 44px), **tepat 1 `btn-primary` per
   layar** ("+ Tambah Anak" / "Mulai Aktivitas Ini" / "Mulai Belajar"),
   urutan Tab logis (skip link → Kembali → sekunder → primary) dengan
   outline fokus terlihat, kontras dihitung dari computed style (primary
   9,88:1 · sekunder 10,52:1 · fakta 9,88:1), `prefers-reduced-motion` →
   transisi 0,01ms. Fungsional: klik "Mulai Aktivitas Ini" → layar
   aktivitas dengan sesi terbuka, klik "Buka layar belajar" →
   `/learn?child=`, catatan "Ada 1 sesi yang belum ditutup." tampil dengan
   benar, dan empty state memuat teks + satu aksi.
5. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — checklist untuk
   tiga layar yang tersentuh: hierarki kini tepat satu primary per layar;
   dekorasi tidak bertambah (0 `@keyframes` baru, 0 animasi terukur);
   target sentuh ≥44px terukur; status teks, bukan warna; nilai visual
   hanya token (tes menolak hex & durasi ms di blok style); audio tidak
   ada; reduced-motion 0,01ms; lolos 390px & 768px. `npm run design:lint`
   → **0 error, 0 warning** (1 info ringkasan token).
6. **Verifikasi**: `npm test` **268 pass / 0 fail** (2 baru di
   `test/anti-slop-action-hierarchy.test.ts`), `tsc --noEmit` bersih,
   `npm run build` hijau, `node scripts/smoke-loop.mjs` →
   **SMOKE_LOOP_OK**, `node scripts/smoke-reviewer.mjs` →
   **SMOKE_REVIEWER_OK**, `npm run perf` → **PERF_OK**.

## Keputusan — OQ 30: banner offline child home (2026-10-08)

Konteks: langkah yang tercatat pada run sebelumnya — perbaiki kontras
`.offline-banner` (`src/pages/learn.astro`) sesuai rekomendasi yang sudah
tertulis di OQ 30.

1. **Perbaikan murni warna lewat token, tanpa perilaku baru**: latar
   `--c-warning` + teks `--c-warm-white` (**2,91:1**) → permukaan tint
   `--c-soft-peach` + teks `--c-ink` = **10,07:1**, mengikuti pola
   `error-note` DESIGN.md. Ikon SVG memakai `currentColor` (ikut ink);
   pasangan `--c-warning` di atas soft-peach hanya **2,27:1** (di bawah
   ambang non-teks 3:1), jadi warning tidak dipakai sama sekali di
   banner. DESIGN.md tetap terpenuhi: warning hanya untuk indikator
   status yang dipasangkan teks — bukan latar teks.
2. **Status tidak disampaikan lewat warna saja**: pesan teks
   "Kamu sedang offline. Beberapa fitur mungkin terbatas." + ikon
   `aria-hidden` sudah membawa maknanya; perubahan warna tidak
   mengubah bahasa status anak. Tidak ada elemen/markup baru, tidak ada
   `@keyframes` baru; animasi `slideUp` tetap `--dur-card` (240ms) dan
   dimatikan oleh `.reduce-motion`.
3. **Dua gerbang baru di `test/color-contrast.test.ts`**:
   (a) kunci blok `.offline-banner` persis — wajib `--c-soft-peach` +
   `--c-ink`, dilarang latar `--c-warning`;
   (b) **pemindaian seluruh `src/`** untuk pasangan `background`+`color`
   token eksplisit dalam blok aturan yang sama — 85 pasangan terdeteksi,
   semuanya ≥4,5:1 (terendah 5,70:1). Ambang deteksi ≥50 pasangan agar
   perubahan pola pemindaian membuat tes **gagal**, bukan lolos membisu.
   Catatan jujur: pemindaian hanya menangkap pasangan eksplisit dalam
   satu blok; teks yang diwarisi dari selektor induk tidak tercakup —
   celah yang sama dengan catatan lama OQ 30, kini dipersempit.
4. **Bukti QA E2E eksploratif** (peramban, server `scripts/qa-server.mjs`
   :4403, sesi orang tua dipasang via CDP `Network.setCookie`, emulasi
   offline `Network.emulateNetworkConditions`):
   - `navigator.onLine = false` → banner tampil, computed style
     `rgb(247, 220, 203)` / `rgb(38, 51, 45)`;
   - **390px**: banner selebar viewport (0,0–390), `scrollWidth` = 390,
     **tanpa overflow horizontal**;
   - **768px**: hal yang sama, banner 768px, tanpa overflow;
   - kembali online → `banner.hidden = true` lagi (listener `online`
     bekerja); ukuran teks 14px/600.
5. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — checklist:
   hierarki layar tak berubah (banner bukan aksi, `/learn` tetap satu
   primary); tidak menambah dekorasi (0 elemen, 0 `@keyframes` baru);
   target sentuh tak relevan (banner non-interaktif); status teks + ikon,
   bukan warna; nilai visual hanya token; audio tidak ada di layar ini;
   reduced motion menonaktifkan animasi banner; lolos 390px & 768px.
   `npm run design:lint` → **0 error, 0 warning** (1 info ringkasan token).
6. **Verifikasi**: `npm test` **270 pass / 0 fail** (2 tes baru di
   `test/color-contrast.test.ts`), `tsc --noEmit` bersih, `npm run build`
   hijau, `node scripts/smoke-loop.mjs` → **SMOKE_LOOP_OK**,
   `node scripts/smoke-reviewer.mjs` → **SMOKE_REVIEWER_OK**,
   `npm run perf` → **PERF_OK**.

## Keputusan — VRD 10.9: kepadatan dashboard orang tua (2026-10-08)

Konteks: 10.9 ("Keep dashboard low-density") adalah satu-satunya item VRD yang
belum tercatat statusnya — dan sifatnya **verifikasi**, bukan perilaku baru,
sehingga aman dikerjakan otomatis tanpa mengarang keputusan produk.

1. **Bukti peramban (QA E2E eksploratif)** — server hasil build
   `scripts/qa-server.mjs` (:4406, database segar, sesi orang tua dipasang lewat
   CDP `Network.setCookie`, layar diukur pada **390px & 768px**):
   - `/parent` (dashboard): **158 kata terlihat**, 3 bagian (Profil Anak Aktif,
     Profil Diarsipkan, Pengaturan), tinggi 1.722px @390 (≈2 layar), muat satu
     layar penuh @768; `scrollWidth = clientWidth` (375 ≤ 390) — **tanpa
     overflow horizontal**; **tepat 1 `btn-primary`**, 0 `<canvas>`, 0 skrip
     eksternal, 0 animasi terukur (`document.getAnimations()`), TTFB 20–30ms.
   - `/parent/anak/:id` (ringkasan berdata): **170 kata**, 5 bagian (3 fakta +
     Riwayat Sesi + Area Belajar + Kekuatan + Saran Latihan), tinggi 2.344px
     @390 (≈2,8 layar) karena daftar bertumpuk vertikal; 1 primary; 0 canvas /
     skrip eksternal / animasi; TTFB 42–56ms.
   - Ringkasan kosong (anak kedua): **28 kata**, satu layar, satu aksi.
   - Jujur soal ambang: PRD §22 "parent can understand child status in under
     30 seconds" **tidak bisa diukur cron** — yang dipakai sebagai proxy: ≤170
     kata terlihat, tanpa grafik/tabel, tiga fakta + satu aksi ada di awal
     layar, TTFB < 60ms. Tidak ada angka ambang yang dikarang di test.
2. **Pemetaan ke PRD §12** (Parent Mode): child profiles ✓ (kartu profil),
   activities completed ✓ (Jawaban tersimpan), session duration ✓ (Sesi
   belajar + durasi), skill progress ✓ (Skill dipraktikkan + Area Belajar),
   recommended practice ✓ (Saran Latihan), settings ✓ (Pengaturan);
   *audio preference* & *session duration preference* = 10.7/10.8 yang masih
   tertahan **OQ 18 + OQ 5** (kartunya sudah tampil, halamannya belum — tidak
   dibangun diam-diam). "Avoid excessive analytics" terpenuhi: tidak ada
   widget angka selain fakta/riwayat/progress bar.
3. **Satu temuan copy yang diperbaiki**: kartu Durasi Sesi menulis
   "(akan hadir di Phase 10)" — **jargon internal roadmap bocor ke layar
   orang tua** (melanggar *Intentionality/Evidence* skill antislop-ui). Kini
   hanya "Batas waktu bermain per sesi." + badge "Segera hadir" yang memang
   sudah ada. Murni copy, tanpa perubahan perilaku/markup/token.
4. **Gerbang baru `test/parent-dashboard-density.test.ts` (4 test)** — mengunci
   *inventaris*, bukan angka kabur:
   - daftar `h2`/`h3` dashboard = persis daftar PRD §12 (menambah panel
     analytics baru harus mengedit gerbang ini secara sadar);
   - bagian ringkasan hanya ⊆ {Riwayat Sesi, Area Belajar, Kekuatan, Saran
     Latihan, Belum ada latihan} + ketiga label `<dt>` wajib ada;
   - tanpa `<canvas>`/`<iframe>`/penjejak (`gtag|analytics|mixpanel|…`)/URL
     eksternal/kata kesombongan (leaderboard, peringkat, poin, streak, …);
   - tanpa jargon internal (`Phase n`, `VRD n`, `OQ n`, `MVP`) di copy kedua
     layar (komentar dokumen dikecualikan).
   **Bukti gerbang tidak vakum**: lima mutasi uji (jargon lama, panel
   `Progres Mingguan` baru, `<canvas>`, "120 poin", `href` eksternal)
   semuanya **DITOLAK** gerbang, sedangkan berkas asli lolos semua.
5. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — tidak ada layar
   baru; checklist dijalankan untuk dua layar yang tersentuh: hierarki tak
   berubah (tepat 1 primary per layar, terukur di 390/768); dekorasi tidak
   bertambah (0 `@keyframes`, 0 animasi terukur); target sentuh tak tersentuh;
   status tetap teks; nilai visual hanya token (tidak ada nilai baru); audio
   OFF; `prefers-reduced-motion` → 0,01ms; copy tanpa jargon internal.
   `npm run design:lint` → **0 error, 0 warning** (1 info token-summary).
6. **Verifikasi**: `npm test` **274 pass / 0 fail** (4 baru), `npx tsc --noEmit`
   bersih, `npm run build` hijau, `node scripts/smoke-loop.mjs` →
   **SMOKE_LOOP_OK**, `node scripts/smoke-reviewer.mjs` → **SMOKE_REVIEWER_OK**,
   `npm run perf` → **PERF_OK**.

## Keputusan — copy tanpa jargon internal di seluruh src (VRD 10.7/10.8/10.10, 2026-10-09)

Konteks: dua run sebelumnya (2026-10-08, commit `b6443ba` dan `690a353`)
menambahkan tiga halaman placeholder pengaturan **tanpa catatan di dokumen
ini**; temuan gerbang VRD 10.9 ("jargon internal bocor ke copy") belum
diperluas ke layar baru itu. Run ini memeriksa ulang seluruh `src/` dan
menutup kelas cacat yang sama.

1. **Enam titik jargon ditemukan & diperbaiki** (murni copy, tanpa
   perubahan perilaku, tanpa nilai visual baru):
   - `parent/pengaturan/audio.astro` — "(PRD §14, VRD 10.7) … (OQ 18)" →
     "Fitur ini belum tersedia. Pilihan suaranya sedang disiapkan dan akan
     muncul di halaman ini begitu siap."
   - `parent/pengaturan/sesi.astro` — "(PRD §12, VRD 10.8) …" → bentuk sama.
   - `parent/pengaturan/privasi.astro` — lima rujukan: "(PRD §8, §14)",
     "(OQ 14)", "(OQ 5, OQ 14)", "(VRD 3.7)", dan nama berkas internal
     `PRIVACY-AUDIT.md` → semua diganti kalimat manusiawi; blok CSS
     `.policy-list code` ikut dibuang karena satu-satunya elemen `<code>`
     sudah tidak ada.
   - `reviewer/aktivitas/impor.astro` — "(PRD §5, VRD 12.5–12.6)" di
     subtitle + "(VRD 12.2)" di daftar field wajib.
   - `components/ActivityEditorForm.astro` — "(PRD §7)" di petunjuk
     "Sumber rujukan".
   - `pages/api/reviewer/aktivitas/import.ts` — pesan sukses impor
     "(VRD 12.6)" (pesan itu tampil di live region UI impor).
   Komentar dokumen di kepala berkas sengaja dibiarkan — itu untuk
   pengembang, bukan untuk layar.
2. **Gerbang regresi baru `test/copy-no-internal-jargon.test.ts` (3 test)**
   memindai **seluruh `src/`** (76 berkas `.astro`/`.ts`/`.html`) setelah
   membuang komentar, terhadap pola `Phase n | VRD n | OQ n | MVP | PRD §…`.
   Anti-vacuous: ≥70 berkas wajib terpindai, lima contoh jargon wajib
   terdeteksi, dan komentar dokumen wajib lolos. Tes ketiga: ketiga halaman
   placeholder wajib menyatakan ketersediaan **lewat teks**, tanpa nama
   berkas internal, tanpa dot status berwarna tanpa label.
3. **Bukti QA E2E eksploratif di peramban** (server hasil build
   `scripts/qa-server.mjs` :4407, sesi orang tua dipasang via CDP
   `Network.setCookie` — tanpa mengetik kata sandi; tiga layar pengaturan
   pada **390px & 768px**): `scrollWidth` = viewport (0 elemen melewati
   viewport selain skip-link *by design*), **0 animasi terukur**, seluruh
   target sentuh ≥44px (skip-link 44px, tautan kembali 44px), **0
   `btn-primary`** (layar informatif — konsisten dengan layar reviewer
   terkunci, tidak ada aksi high-emphasis yang bersaing), `innerText` tanpa
   jargon dan tanpa nama berkas internal, status "belum tersedia" berupa
   teks. Kontras dihitung dari computed style + rantai latar efektif —
   terendah **5,70:1** (muted-ink 20px di ivory), semuanya ≥4,5:1:
   muted-ink/warm-white 5,83 · ink/warm-white 12,87 · deep-green/soft-blue
   8,26 · ink/soft-peach 10,07 · deep-green/ivory 9,65.
   `prefers-reduced-motion` → transisi `1e-05s` (0,01ms). Tanpa sesi →
   303 `/login` untuk ketiga halaman.
4. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — checklist untuk
   tiga layar placeholder: hierarki tanpa aksi high-emphasis (hanya tautan
   kembali); dekorasi ~0 (0 `@keyframes` baru, 0 animasi terukur); target
   sentuh ≥44px terukur; status disampaikan teks, bukan warna; nilai visual
   hanya token (`--c-*`/`--sp-*`/`--fs-*`/`--dur-*`/`--touch-min`, tidak ada
   hex baru); tidak ada audio di layar ini; reduced-motion 0,01ms; lolos
   390px & 768px. `npm run design:lint` → **0 error, 0 warning** (1 info
   ringkasan token).
5. **Verifikasi**: `npm test` **277 pass / 0 fail** (3 baru), `npx tsc
   --noEmit` bersih, `npm run build` hijau, `node scripts/smoke-loop.mjs` →
   **SMOKE_LOOP_OK**, `node scripts/smoke-reviewer.mjs` →
   **SMOKE_REVIEWER_OK**, `npm run perf` → **PERF_OK**.
6. **Tidak dikerjakan (tetap menunggu keputusan)**: menyimpan preferensi
   audio / durasi sesi ke `app_setting` (OQ 5 + OQ 18), ekspor data dan
   hapus permanen (OQ 14). Placeholder sengaja tidak menulis apa pun —
   mengisi preferensi sebelum keputusan produk = mengarang perilaku.

## Keputusan — QA E2E eksploratif layar anak + 4 perbaikan (2026-10-09, run ini)

Konteks: status sebelumnya menyatakan semua sisa fase menunggu keputusan;
langkah aman yang tersisa adalah **verifikasi loop belajar di peramban**
(VRD 16.10–16.13 viewport/target sentuh + 17.1/17.13 tinjauan visual) untuk
layar anak — satu-satunya kelompok layar yang belum pernah diuji sekelas
QA layar reviewer/orang tua (2026-10-08).

1. **Metode**: `scripts/qa-server.mjs` (port 4408, lalu 4409 setelah build
   ulang), sesi orang tua + reviewer dipasang via CDP `Network.setCookie`
   (tanpa mengetik kata sandi), aktivitas TAP_ANSWER diterbitkan lewat matriks
   PRD §7, empat layar anak diukur pada **390px & 768px**: child home
   (berdata + kosong), detail area, layar aktivitas TAP_ANSWER dan
   TRUE_FALSE. Alur dijalankan sungguhan: salah → petunjuk → coba lagi →
   benar → "Aktivitas Berikutnya".
2. **Yang lolos tanpa perubahan**: `scrollWidth` = viewport di semua layar
   kedua viewport; 0 elemen melewati viewport; 0 animasi terukur;
   `prefers-reduced-motion` → transisi 0,01ms; status selalu teks; tanpa
   jargon internal; tanpa tautan eksternal di mode anak; kontras dihitung
   dari computed style (terendah 5,83:1); empty state anak kedua benar;
   skip-link 44px; loop fungsional utuh.
3. **Empat temuan yang diperbaiki**:
   - **F1 — target sentuh**: `.btn-home` child home terukur **40×40px** di
     390 & 768 (di bawah `--touch-min` 44px, melanggar DESIGN.md *Layout &
     Spacing*). Kini `width/height: var(--touch-min)`; terukur 44×44.
   - **F2 — hierarki aksi**: `/learn/area/:code` memasang `.btn-primary`
     pada setiap baris aktivitas (2 kini; bisa 25 saat Phase 13) — bertentangan
     dengan *"`button-primary` is the sole high-emphasis action per screen"*.
     Baris kini memakai `btn-secondary` (warm yellow + ink = **10,52:1**, hover
     cincin inset `--c-ink` — persis pola kartu profil); halaman jadi **0
     primary** (konsisten dengan layar daftar/terkunci reviewer), child home
     tetap tepat 1 primary.
   - **F3 — penjelasan konten tidak pernah sampai ke anak (VRD 6.12)**:
     field `explanation` aktivitas ("Umpan balik untuk anak",
     `docs/AI-DRAFT-SCHEMA.md`; daftar field PRD §7) diteruskan halaman ke
     `renderActivity({ explanation })` tetapi **renderer tidak pernah
     memakainya**, dan endpoint hanya mengembalikan teks generik
     `validateAnswer` — anak melihat "✓ Benar!" lalu "Benar!" (duplikat),
     bukan "Apel berwarna merah.". Kini modul murni baru
     `src/lib/activity/feedback.ts` (`feedbackExplanation`) dipakai
     `/api/activity/attempt` **dan** `/api/reviewer/aktivitas/:id/preview`
     (pratinjau = umpan balik produksi, acceptance 11.12): penjelasan konten
     → teks mesin penilaian → jatuh ke rumus lama. Bukti peramban: kedua
     penjelasan konten tampil pada jawaban benar **dan** salah, hint tetap.
   - **F4 — copy**: label TAP_ANSWER **"Tukar Jawaban"** (salah terjemah
     dari "Tap Answer"; tukar = menukar) → **"Pilih Jawaban"** di
     `labels.ts` + legend panel editor reviewer — tampil di child home,
     detail area, dan meta layar aktivitas.
4. **Gerbang regresi (5 test baru)**:
   - `test/anti-slop-action-hierarchy.test.ts` +2: halaman area wajib 0
     `btn-primary` & baris memakai sekunder token-only; `.btn-home` wajib
     `var(--touch-min)` (menolak `width: 40px`) + child home tepat 1 primary.
   - `test/child-loop-feedback.test.ts` (baru) +3: prioritas penjelasan
     konten beserta dua jalur jatuh, kedua endpoint wajib lewat
     `feedbackExplanation` (klausa penolakan `verdict.explanation ?? …`
     memastikan jalur lama tidak lolos diam-diam), kosakata 8 tipe tanpa
     enum mentah + kata lama hilang dari src (komentar dikecualikan).
5. **Anti-slop (DESIGN-SYSTEM §12 + skill antislop-ui)** — checklist untuk
   tiga layar yang tersentuh: hierarki kini tepat satu aksi high-emphasis per
   layar anak (area 0 primary, child home 1, layar aktivitas aksi sesudah
   jawab); dekorasi tidak bertambah (0 `@keyframes` baru, 0 animasi terukur);
   target sentuh **semua ≥44px terukur di 390 & 768**; status teks, bukan
   warna; nilai visual hanya token (blok style bebas hex & durasi ms, diuji);
   tidak ada audio; `prefers-reduced-motion` → 0,01ms; lolos kedua viewport.
   `npm run design:lint` → **0 error, 0 warning** (1 info ringkasan token).
6. **Verifikasi**: `npm test` **282 pass / 0 fail** (5 baru), `npx tsc
   --noEmit` bersih, `npm run build` hijau, `node scripts/smoke-loop.mjs` →
   **SMOKE_LOOP_OK**, `node scripts/smoke-reviewer.mjs` → **SMOKE_REVIEWER_OK**,
   `npm run perf` → **PERF_OK**.
7. **Sengaja tidak dikerjakan**: preferensi audio/durasi/retensi (OQ 5/18/14),
   UI baseline (OQ 16/17), ambang mastery (OQ 23), provider AI (OQ 26),
   guard perubahan belum disimpan (OQ 29) — tetap menunggu keputusan.

## Untuk run berikutnya

- **Status 2026-10-09 (run ini)**: QA E2E eksploratif **layar anak** selesai
  (4 temuan diperbaiki, lihat keputusan di atas) — loop belajar kini teruji di
  peramban seperti layar reviewer/orang tua. Sisanya tetap menunggu
  keputusan/review Arsyad:
  - **Phase 13 (seed 100 aktivitas)** — konten wajib lewat review manusia;
    jalur impor batch (`/reviewer/aktivitas/impor`) sudah siap.
  - **OQ 16/17** — UI onboarding baseline (butuh titik masuk + konten ≥5).
  - **OQ 5/18/14** — perilaku halaman pengaturan yang kini sudah ada
    sebagai placeholder: preferensi audio, batas durasi sesi, ekspor/hapus
    permanen (VRD 10.7/10.8/10.10 lanjutan + 14.1–14.3).
  - **OQ 23** — ambang mastery / dasar rekomendasi bergeser (9.6).
  - **OQ 26** — provider/model AI untuk generate batch draf (12.2).
  - **OQ 29** — guard "ada perubahan belum disimpan" sebelum transisi
    status reviewer (perilaku, bukan kosmetik).
  - **OQ 2** — deployment target (Phase 19). **OQ 27** — header cache
    aset `public/` (temuan 18.5, dampak kecil).
- **Gerbang copy baru**: setiap layar/pesan baru wajib lolos
  `test/copy-no-internal-jargon.test.ts` — jangan menulis "Phase/VRD/OQ/PRD"
  di teks yang dibaca pengguna (komentar dokumen tetap boleh).
- **Kalau Arsyad menjawab salah satu OQ di atas** → kerjakan item VRD yang
  terbuka (mis. OQ 16/17 → 8.7 UI baseline; OQ 23 → 9.6; OQ 5/18 → 10.7 +
  14.1–14.3; OQ 14 → 10.10 ekspor/hapus).
- **Verifikasi ulang tiap run**: `npm test && ./node_modules/.bin/tsc --noEmit && npm run build && node scripts/smoke-loop.mjs && node scripts/smoke-reviewer.mjs && npm run perf` (harus `SMOKE_LOOP_OK` + `SMOKE_REVIEWER_OK` + `PERF_OK`); lint `npm run design:lint` bila ada sentuhan UI.
- Kalau tidak ada yang berubah sejak run terakhir → jawab `[SILENT]`.

## Catatan run sebelumnya (arsip)

- **Loop belajar utuh & terverifikasi E2E (2026-10-06)** — OQ 19 selesai,
  Phase 7.5/7.6/7.7 tutup. Verifikasi ulang dengan `npm run build &&`
  `node scripts/smoke-loop.mjs` (harus `SMOKE_LOOP_OK`) sebelum lanjut.
- **OQ 21 selesai 2026-10-06** — konvensi payload kini mengikat di
  CONTENT-SPEC §7 + `test/content-payload-conventions.test.ts`.
- **VRD 9.8 selesai 2026-10-06** — `src/lib/progress/summary.ts` +
  `GET /api/parent/progress` (fakta murni, tanpa UI). Phase 9 kini hanya
  menyisakan **9.6 yang menunggu OQ 23** (bukti ambang mastery / apakah
  rekomendasi cukup berbasis "skill belum pernah dicoba").
- **VRD 10.1 selesai 2026-10-06** — `/parent/anak/:id` (3 fakta + empty
  state) + tautan "Ringkasan" di kartu profil; 187 test, SMOKE_LOOP_OK
  (31 cek), lint DESIGN.md 0 error.
- **VRD 10.2 selesai 2026-10-06** — daftar sesi belajar di ringkasan anak
  (badge Asesmen/Terbuka, jumlah jawaban, durasi, selesai); terverifikasi
  E2E via `smoke-loop.mjs`.
- **VRD 10.3 selesai 2026-10-06 (run ini)** — area belajar dengan progressbar
  (attempted/total skill), teks "n selesai", aria-label; token desain saja.
  187 test, tsc bersih, build hijau, SMOKE_LOOP_OK.
- **UI onboarding baseline (OQ 16 + OQ 17) masih tertahan**: butuh konfirmasi
  Arsyad soal titik masuk, **dan** sampai Phase 13 menanam konten kolam
  baseline <5 aktivitas (POST menolak) sehingga layarnya akan selalu buntu.
  Jangan bangun layar mati — tunda sampai salah satu syarat terpenuhi.
- **VRD 11.2–11.10 selesai 2026-10-07** — editor aktivitas (daftar, buat,
  edit) + API + gerbang status + perbaikan login reviewer.
- **VRD 11.11 selesai 2026-10-07 (run ini)** — matriks transisi PRD §7
  (`review-flow.ts` + trigger migrasi 0005), `POST /api/reviewer/aktivitas/:id/status`,
  jejak `content_review` + riwayat di layar detail (`ReviewFlowPanel`).
  228 test, tsc bersih, build hijau, lint DESIGN.md 0 error,
  SMOKE_LOOP_OK + **SMOKE_REVIEWER_OK** (`npm run smoke:reviewer`, baru).
- **VRD 11.12 selesai 2026-10-07 (run ini)** — pratinjau sebagai anak:
  halaman `/reviewer/aktivitas/:id/pratinjau` (perender produksi, pilih usia
  rentang target, catatan "tidak disimpan") + `POST .../preview` yang menilai
  tanpa menulis data anak + cabang `cfg.preview` di runtime. 238 test,
  tsc bersih, build hijau, lint DESIGN.md 0 error, SMOKE_LOOP_OK +
  SMOKE_REVIEWER_OK.
- **VRD 11.14 selesai 2026-10-07 (run ini)** — feed anak tertutup untuk
  konten non-published: `test/phase11-14-draft-feed.test.ts` (4 test) menutup
  semua jalur baca anak — daftar per usia, daftar per area, ambil-satu,
  rekomendasi berikutnya, kolam asesmen dasar — terhadap DRAFT/HUMAN_REVIEW/
  QA_APPROVED/FLAGGED/UNPUBLISHED; endpoint `session/start` &
  `activity/attempt` menjawab 404 tanpa menulis sesi/attempt (kontrol positif
  PUBLISHED tetap 201/201); **guard sumber** memaksa setiap query
  `FROM activity` di `src/lib` + `src/pages` non-reviewer menyaring
  `review_status = 'PUBLISHED'`. Satu penguatan: re-select detail di
  `GET /api/assessment/baseline` kini ikut menyaring status. 242 test, tsc
  bersih, build hijau, lint DESIGN.md 0 error.
- **VRD 10.4–10.5 selesai 2026-10-07 (run ini)** — kekuatan (judul skill
  manusiawi, sampel `n jawaban`, seleksi murni di
  `src/lib/progress/strengths.ts`) + saran latihan (label tipe/tingkat +
  empty state) di `/parent/anak/:id`; 248 test, tsc bersih, build hijau,
  SMOKE_LOOP_OK + SMOKE_REVIEWER_OK, lint DESIGN.md 0 error.
- **VRD 12.1/12.3–12.6 selesai 2026-10-07 (run ini)** — skema batch draf +
  templat prompt (`docs/AI-DRAFT-SCHEMA.md`, modul murni
  `src/lib/activity/ai-draft.ts`) + `POST /api/reviewer/aktivitas/import`
  (divalidasi dua lapis, ditolak utuh per batch, ditandai `AI_DRAFT`,
  disimpan `DRAFT`); 258 test, tsc bersih, build hijau,
  SMOKE_LOOP_OK + SMOKE_REVIEWER_OK, lint DESIGN.md 0 error.
- **Langkah berikutnya: VRD 14.4–14.7 — audit gerak & audio** (verifikasi
  musik OFF default, semua animasi dalam budget 120–700ms,
  `prefers-reduced-motion` benar-benar menghapus gerak nonesensial, buang
  gerak terus-menerus yang tidak perlu). Audit murni-verifikasi, tanpa
  keputusan produk baru; **14.1–14.3 (mute/SFX/suara) tetap menunggu OQ 18
  + OQ 5**. Setelah itu lanjut **Phase 15 (Privacy & Child Safety review,
  15.1–15.10)** — juga verifikasi bukan pembangunan fitur.
  Fase lain masih tertahan keputusan (10.7/10.8/10.10 → OQ 18 + OQ 14;
  Phase 8 → OQ 16/17; Phase 9.6 → OQ 23; **VRD 12.2 generate batch → OQ 26**
  — jalur impor `.../import` sudah siap menunggu keputusan provider).
  **Phase 13 (seed 100 aktivitas)** baru dimulai kalau Arsyad siap
  me-review: draf bisa masuk lewat endpoint impor, tetapi penerbitan tetap
  butuh klik reviewer (VRD 13.13) — jangan ditekan otomatis.
- **Verifikasi ulang tiap run**: `npm test && ./node_modules/.bin/tsc --noEmit && npm run build && node scripts/smoke-loop.mjs && node scripts/smoke-reviewer.mjs` (harus `SMOKE_LOOP_OK` + `SMOKE_REVIEWER_OK`).
- **Perbaikan tautan pengaturan → OQ 18 (Phase 10/14).**
