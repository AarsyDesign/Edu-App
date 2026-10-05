-- 0003_seed_learning_areas_skills.sql — Seed enam learning area MVP + skill awal (VRD Phase 5)
-- Sumber: PRD §4 (enam mata pelajaran), CONTENT-SPEC.md (distribusi aktivitas per area),
-- VRD 5.1–5.5 (seed, age suitability, difficulty, prerequisite).
-- Kaidah: forward-only, satu file = satu transaksi, checksum di schema_migrations.

-- ============================================================
-- LEARNING AREA — Enam mata pelajaran MVP (PRD §4)
-- Urutan tampil mengikuti sort_order.
-- ============================================================

INSERT INTO learning_area (code, title, sort_order, is_active) VALUES
  ('numbers',     'Angka & Berhitung',     1, true),
  ('letters',     'Huruf & Bahasa',        2, true),
  ('logic',       'Logika',                3, true),
  ('shapes',      'Bentuk & Warna',        4, true),
  ('world',       'Mengenal Dunia',        5, true),
  ('adab_islam',  'Adab & Islam',          6, true)
ON CONFLICT (code) DO UPDATE SET
  title      = EXCLUDED.title,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;

-- ============================================================
-- SKILL — Keterampilan awal per area (VRD 5.2–5.5)
-- difficulty: 1 = paling mudah .. 3 = paling menantang (skala netral).
-- age_min/age_max: rentang usia target (PRD §3).
-- Prerequisite: skill_id yang harus dikuasai dulu (opsional, VRD 5.5).
-- ============================================================

-- Variabel UUID learning area untuk referensi FK komposit (skill_id, learning_area_id)
-- Kita pakai CTE agar insert skill bisa pakai FK komposit tanpa hardcode UUID.
WITH la AS (
  SELECT id, code FROM learning_area
)
INSERT INTO skill (learning_area_id, code, title, description, age_min, age_max, difficulty, sort_order)
SELECT la.id, s.code, s.title, s.description, s.age_min, s.age_max, s.difficulty, s.sort_order
FROM la
JOIN (VALUES
  -- 1. Angka & Berhitung (PRD §3: 3–4: counting 1–5; 5–6: 1–10/20; 6–7: tambah/kurang)
  ('numbers', 'count_1_3',     'Menghitung 1–3',           'Mengenal jumlah 1 sampai 3 dengan benda konkret',         3, 4, 1, 1),
  ('numbers', 'count_1_5',     'Menghitung 1–5',           'Menghitung benda 1 sampai 5',                              3, 5, 1, 2),
  ('numbers', 'count_1_10',    'Menghitung 1–10',          'Menghitung dan mengenali angka 1–10',                    4, 6, 1, 3),
  ('numbers', 'number_recog',  'Mengenali Angka',          'Mencocokkan simbol angka dengan jumlah',                  4, 6, 1, 4),
  ('numbers', 'more_less',     'Lebih & Kurang',           'Membandingkan dua kelompok benda: mana lebih/kurang',     4, 6, 2, 5),
  ('numbers', 'same_amount',   'Jumlah Sama',              'Menemukan kelompok dengan jumlah yang sama',              4, 6, 2, 6),
  ('numbers', 'sequence_num',  'Urutan Angka',             'Menyusun angka 1–10 dalam urutan yang benar',             5, 7, 2, 7),
  ('numbers', 'simple_add',    'Tambah Sederhana',         'Menjumlahkan dua kelompok benda (total ≤ 10)',            5, 7, 2, 8),
  ('numbers', 'simple_sub',    'Kurang Sederhana',         'Mengurangi benda dari sebuah kelompok (awal ≤ 10)',       6, 7, 2, 9),
  ('numbers', 'count_1_20',    'Menghitung 1–20',          'Menghitung dan mengenali angka 1–20',                    6, 7, 2, 10),

  -- 2. Huruf & Bahasa (PRD §3: 5–6: pengenalan huruf, kata sederhana; 6–7: baca kalimat pendek, vocabulary, Bahasa Inggris dasar)
  ('letters', 'letter_recog',  'Mengenali Huruf',          'Mengenali huruf vokal dan konsonan',                      4, 6, 1, 1),
  ('letters', 'initial_sound', 'Suara Awal',               'Mencocokkan gambar dengan huruf suara awalnya',           4, 6, 1, 2),
  ('letters', 'letter_object', 'Huruf & Benda',            'Menyamakan huruf dengan benda yang diawali huruf itu',    4, 6, 1, 3),
  ('letters', 'simple_vocab',  'Kosa Kata Sederhana',      'Mengenali kata sehari-hari (ibu, ayah, buku, bola)',      4, 6, 1, 4),
  ('letters', 'word_picture',  'Kata & Gambar',            'Menyamakan kata tertulis dengan gambarnya',               5, 7, 1, 5),
  ('letters', 'missing_letter','Huruf Hilang',             'Melengkapi kata dengan huruf yang hilang (usia 6+)',      6, 7, 2, 6),
  ('letters', 'read_sentence', 'Baca Kalimat Pendek',      'Membaca kalimat 2–3 kata dengan bantuan gambar',          6, 7, 2, 7),
  ('letters', 'basic_english', 'Bahasa Inggris Dasar',     'Mengenali huruf & kata sederhana Bahasa Inggris',         6, 7, 2, 8),

  -- 3. Logika (PRD §3: matching, classification, sequence, pola, ukuran)
  ('logic',     'matching',     'Mencocokkan',              'Menemukan pasangan yang sama (bentuk, warna, pola)',      3, 5, 1, 1),
  ('logic',     'classification','Klasifikasi',             'Mengelompokkan benda berdasarkan sifat (warna/bentuk)',   4, 6, 1, 2),
  ('logic',     'sequence',     'Menyusun Urutan',          'Menyusun 3–4 langkah dalam urutan logis',                4, 6, 1, 3),
  ('logic',     'odd_one_out',  'Yang Berbeda',             'Menemukan satu yang tidak termasuk kelompok',             5, 6, 2, 4),
  ('logic',     'simple_pattern','Pola Sederhana',          'Melanjutkan pola ABAB / ABCABC (bentuk/warna)',           5, 6, 2, 5),
  ('logic',     'size_order',   'Mengurutkan Ukuran',       'Menyusun benda dari terkecil ke terbesar (3–5 item)',     4, 6, 1, 6),

  -- 4. Bentuk & Warna (PRD §3: warna primer, bentuk dasar, ukuran, posisi)
  ('shapes',    'primary_color','Warna Primer',             'Mengenali merah, kuning, biru',                          3, 4, 1, 1),
  ('shapes',    'secondary_color','Warna Sekunder',         'Mengenali hijau, oranye, ungu',                          4, 5, 1, 2),
  ('shapes',    'match_color',  'Cocokkan Warna',           'Menyamakan benda dengan warna yang sama',                3, 5, 1, 3),
  ('shapes',    'basic_shapes', 'Bentuk Dasar',             'Mengenali lingkaran, persegi, segitiga, persegi panjang', 3, 5, 1, 4),
  ('shapes',    'shape_match',  'Cocokkan Bentuk',          'Menyamakan bentuk dengan bayangannya',                   3, 5, 1, 5),
  ('shapes',    'size_concept', 'Besar & Kecil',            'Membandingkan ukuran: besar/kecil, panjang/pendek',       3, 5, 1, 6),
  ('shapes',    'position',     'Posisi',                   'Memahami atas/bawah, dalam/luar, depan/belakang',         4, 6, 1, 7),

  -- 5. Mengenal Dunia (PRD §3: benda sehari-hari, rumah/sekolah, alam, keamanan sederhana)
  ('world',     'everyday_obj', 'Benda Sehari-hari',        'Mengenali benda di rumah: sendok, gelas, bantal',         3, 5, 1, 1),
  ('world',     'home_school',  'Rumah & Sekolah',          'Mengenali bagian ruangan & fasilitas sekolah',            4, 6, 1, 2),
  ('world',     'nature',       'Alam',                     'Mengenali matahari, bulan, bintang, pohon, air',          3, 6, 1, 3),
  ('world',     'simple_safety','Keamanan Sederhana',       'Tahu: tidak main api, tidak lari di jalan',               4, 7, 1, 4),
  ('world',     'body_env',     'Diri & Lingkungan',        'Mengenali bagian tubuh luar & lingkungan dekat',          4, 6, 1, 5),

  -- 6. Adab & Islam (PRD §3: adab dasar, doa terverifikasi, masjid, wudhu, vocab Islam)
  ('adab_islam','basic_adab',   'Adab Dasar',               'Mengucapkan salam, terima kasih, maaf, izin',            3, 7, 1, 1),
  ('adab_islam','simple_dua',   'Doa Sederhana',            'Doa sebelum/selepas makan, tidur, bangun (terverifikasi)', 4, 7, 1, 2),
  ('adab_islam','recognize_mosque','Mengenali Masjid',      'Mengenali masjid sebagai tempat ibadah',                 3, 6, 1, 3),
  ('adab_islam','wudhu_seq',    'Urutan Wudhu',             'Menyusun gerakan wudhu 3–5 langkah (tanpa detail biologi)', 5, 7, 2, 4),
  ('adab_islam','islam_vocab',  'Kosakata Islam Dasar',     'Mengenali: Allah, Rasul, Al-Qur’an, solat, puasa',       4, 7, 1, 5),
  ('adab_islam','meal_manners', 'Adab Makan',               'Cuci tangan, doa makan, makan dengan tangan kanan',      4, 7, 1, 6),
  ('adab_islam','respect_parents','Hormat Orang Tua',        'Memahami: taat & berbuat baik pada orang tua',           4, 7, 1, 7),
  ('adab_islam','cleanliness',  'Kebersihan',               'Mengenali kebersihan sebagai bagian iman',               4, 7, 1, 8)
) AS s(area_code, code, title, description, age_min, age_max, difficulty, sort_order)
  ON la.code = s.area_code
ON CONFLICT (learning_area_id, code) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  age_min     = EXCLUDED.age_min,
  age_max     = EXCLUDED.age_max,
  difficulty  = EXCLUDED.difficulty,
  sort_order  = EXCLUDED.sort_order;