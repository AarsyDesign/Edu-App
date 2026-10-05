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
| 3 | Authentication and Parent Ownership | ✅ DONE | 2026-10-05 (commit menyusul) — 3.1–3.11 lengkap: endpoint + UI login/daftar + middleware rute + gerbang kepemilikan + **3.9 rate limiting** |
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
11. **Konvensi namespace API terlindungi**: gerbang middleware kini menjaga
    `/parent`, `/api/parent`, dan `/api/children`. PRD/VRD tidak menentukan
    bentuk endpoint profil anak, jadi prefiks itu adalah **asumsi penamaan**,
    bukan kebutuhan. Bila Phase 4 memakai namespace lain, tambahkan ke
    `PROTECTED_PREFIXES` **dan** tetap panggil `getChildForParent()` — jangan
    mengandalkan prefiks saja untuk kepemilikan.
