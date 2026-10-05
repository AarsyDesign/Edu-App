# Database Migrations

Forward-only. Satu file SQL = satu transaksi, diterapkan sekali dan dicatat di
tabel `schema_migrations` (id + checksum SHA-256 + waktu).

## Aturan

1. **Jangan edit file yang sudah diterapkan.** Runner akan menolak perbedaan
   checksum. Untuk perubahan skema: buat `0002_nama_pendek.sql` baru.
2. **Urutan** = urutan alfabetis nama file (`0001_...`, `0002_...`).
3. **Gagal = batal.** Tidak ada potongan skema yang tertinggal (VRD 2.15).
4. **Verifikasi dari database bersih** wajib sebelum dianggap selesai — jalankan
   `npm test` (test/data-model.test.ts membangun DB kosong in-memory lalu
   menerapkan seluruh folder migrasi ini).
5. Tidak ada skrip `down`. Strategi pemulihan: kembalikan backup, atau untuk
   pengembangan hapus folder database lalu terapkan ulang dari nol.

## Mesin

Kini: PGlite (PostgreSQL embedded) lewat `src/lib/db/` — mesin lokal tidak punya
server PostgreSQL. Tujuan akhir (PRD §19): managed PostgreSQL. File SQL ini dibuat
standar PostgreSQL agar bisa dipakai apa adanya.
