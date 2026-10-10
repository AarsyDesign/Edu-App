# Tangkapan Layar QA (VRD 17.12)

Bukti visual tinjauan anti-slop/ QA E2E eksploratif, direkam **2026-10-10**
dari server hasil build (`npm run build && node scripts/qa-server.mjs`)
memakai peramban sesi (CDP) — bukan mockup.

## Yang difoto

| Berkas | Layar | Viewport |
|--------|-------|----------|
| `desktop-1280-01-beranda.png` | Beranda publik `/` | 1280×800 |
| `desktop-1280-02-login.png` | Masuk akun orang tua `/login` | 1280×800 |
| `desktop-1280-03-dashboard-orang-tua.png` | Dashboard `/parent` | 1280×800 |
| `desktop-1280-04-ringkasan-anak.png` | Ringkasan anak `/parent/anak/:id` | 1280×800 |
| `desktop-1280-05-child-home.png` | Child home `/learn` | 1280×800 |
| `desktop-1280-06-aktivitas-anak.png` | Layar aktivitas anak | 1280×800 |
| `desktop-1280-07-daftar-reviewer.png` | Daftar aktivitas reviewer | 1280×800 |
| `desktop-1280-08-edit-aktivitas.png` | Editor aktivitas reviewer | 1280×800 |
| `desktop-1280-09-halaman-404.png` | Halaman 404 | 1280×800 |
| `mobile-390-01-child-home.png` | Child home | 390×844 |
| `mobile-390-02-aktivitas-anak.png` | Layar aktivitas (sebelum menjawab) | 390×844 |
| `mobile-390-03-aktivitas-umpan-balik.png` | Umpan balik "Belum tepat" + petunjuk | 390×844 |
| `mobile-390-04-dashboard-orang-tua.png` | Dashboard orang tua | 390×844 |

## Catatan kejujuran data

- Semua isi berasal dari **fixture server QA**: akun + profil anak nama
  samaran (Rania, Dimas) yang dibuat lewat API di database segar khusus QA,
  hanya di `localhost`. **Tidak ada data anak sungguhan** — baik di berkas
  ini maupun di repo.
- Aktivitas yang tampil ditanam skrip QA lewat matriks review PRD §7
  (bukan konten pendidikan resmi); konten Phase 13 tetap lewat review
  manusia.
- Matriks viewport yang diukur run ini: **360px** (Android kecil, ukur
  saja), **390px**, **768px** (run sebelumnya), dan **1280px** (desktop
  responsive fallback, QA-ACCEPTANCE *Visual Review*). Semua: `scrollWidth`
  = lebar viewport, 0 elemen melewati viewport, 0 animasi liar.

## Cara memperbarui

```bash
npm run build && QA_PORT=4413 node scripts/qa-server.mjs   # catat baris QA_SERVER_READY
# lalu rekam lewat peramban sesi (CDP), salin shot.png ke nama di tabel atas
```
