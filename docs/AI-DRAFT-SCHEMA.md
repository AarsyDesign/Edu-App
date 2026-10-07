# AI-DRAFT-SCHEMA.md — Skema Batch Draf Aktivitas

Normative source: `src/lib/activity/ai-draft.ts` + executable spec
`test/phase12-ai-draft.test.ts`. Bila dokumen ini dan kode berbeda, kode
yang menang — perbaiki dokumennya.

Menutup sebagian VRD Phase 12: **12.1** (skema + templat prompt), **12.3**
(validasi skema), **12.4** (draf rusak ditolak), **12.5** (penandaan
`AI_DRAFT`), **12.6** (masuk antrean review manusia).

**VRD 12.2 (generate small batches) BELUM dibangun** — menunggu keputusan
provider/model (OQ 26 di `docs/IMPLEMENTATION-AUDIT.md`). Skema ini tidak
mengasumsikan API apa pun: batch bisa berasal dari model mana pun, dari
skrip lokal, bahkan dari hasil tulis-tangan selama mengikuti bentuk di sini.

Alur yang ditetapkan PRD §5: `AI draft → human review → correction → QA →
publish`. PRD §19: AI content generation **di luar jalur runtime anak** —
tidak ada satu pun kode di halaman `/learn` yang membaca skema ini.

## 1. Amplop batch

Satu request = satu objek (bukan array):

| Field | Wajib | Tipe | Aturan |
|-------|-------|------|--------|
| `schema_version` | ya | number | Harus persis `1`. Versi lain → ditolak. |
| `drafts` | ya | array | 1–25 draf (batch kecil sesuai VRD 12.2). |
| `model` | tidak | string | Nama model pembangkit, maks 120 karakter. Provenance saja — bukan kredensial. |
| `prompt_version` | tidak | string | Versi templat prompt, maks 120 karakter. |

## 2. Satu draf

Semua field memakai snake_case, konsisten dengan payload editor
(CONTENT-SPEC §7). `area_code`/`skill_code` dipakai **bukan UUID** — generator
di luar aplikasi tidak tahu UUID; kode diambil dari seed
`db/migrations/0003_seed_learning_areas_skills.sql`.

| Field | Wajib | Aturan |
|-------|-------|--------|
| `area_code` | ya | `^[a-z0-9_]{1,60}$`, harus area aktif. Nilai sah: `numbers`, `letters`, `logic`, `shapes`, `world`, `adab_islam`. |
| `skill_code` | tidak | Pola sama, harus milik area itu. Kosong = skill pertama area (urut `sort_order`). |
| `prompt` | ya | Teks pertanyaan/instruksi, trim, maks 500 karakter. |
| `interaction_type` | ya | Salah satu dari 8 tipe MVP: `TAP_ANSWER`, `COUNT_OBJECTS`, `MATCH`, `SEQUENCE`, `IDENTIFY_COLOR`, `IDENTIFY_SHAPE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`. |
| `target_age_min`, `target_age_max` | ya | Bilangan bulat 3–7, min ≤ max. |
| `difficulty` | ya | Bilangan bulat 1–3. |
| `correct_answer` | ya | Objek sesuai tipe — kontrak lihat CONTENT-SPEC §7.2; divalidasi `validateActivityData`. |
| `explanation` | tidak | Umpan balik untuk anak, maks 1000 karakter. |
| `sources` | tidak | Daftar, maks 5; tiap sumber: `title` (≤300), `source_type` (≤60), `reference_detail` (≤2000), `methodology` (≤2000, opsional), `is_disputed` (boolean). Konten wajib sumber bila diminta CONTENT-SPEC. |
| `content_origin` | — | **Field ini tidak dibaca.** Selalu dipaksa `AI_DRAFT` (VRD 12.5) — lihat §4. |

Field tambahan yang tidak dikenal diabaikan (model sering menambah catatan),
kecuali nilai yang melanggar aturan di atas.

## 3. Aturan batch (VRD 12.3–12.4)

1. Seluruh batch divalidasi **sebelum satu baris pun ditulis**. Satu draf
   gagal → batch utuh ditolak `400 DRAFT_BATCH_INVALID` dengan pesan
   `Draf ke-N: <alasan>`. Tidak pernah ada batch setengah jadi.
2. `area_code`/`skill_code` yang tidak dikenal = penolakan, bukan fallback
   diam-diam ke area lain.
3. Setelah lolos, endpoint memvalidasi ulang lewat `parseEditorPayload`
   (satu pintu validasi editor, VRD 11.2) — lapis ganda, bukan salinan
   aturan.

## 4. Penandaan & status (VRD 12.5–12.6)

- Setiap draf tersimpan dengan `content_origin = 'AI_DRAFT'` **tanpa
  kecuali** — field asal dari draf tidak pernah dibaca, jadi konten AI tidak
  bisa menyamar sebagai `HUMAN_CREATED` lewat impor.
- Setiap draf lahir sebagai `review_status = 'DRAFT'`. Impor **tidak pernah**
  menaikkan status; hanya reviewer yang menjalankan transisi normal
  (`DRAFT → HUMAN_REVIEW → QA_APPROVED → PUBLISHED`, VRD 11.11/11.13).
- Di antrean reviewer, draf impor tampil dengan label asal **"Draf AI"**.
- Feed anak menyaring `review_status = 'PUBLISHED'` (VRD 11.14), jadi draf
  impor tidak terlihat oleh anak sampai melalui seluruh alur review.

## 5. Templat prompt (VRD 12.1)

Tempel templat ini ke model apa pun (isi `{DAFTAR_SKILL}` dengan baris
`area_code/skill_code — deskripsi` dari seed). Prompt ini tidak memanggil
API apa pun; pemilihan model tetap keputusan OQ 26.

```text
Kamu adalah penulis aktivitas belajar untuk anak usia 3-7 tahun.
Buat {N} draf aktivitas dalam Bahasa Indonesia, sederhana, tanpa pertanyaan
jebakan, satu tujuan belajar per aktivitas, tanpa menggambarkan makhluk
hidup, tanpa data pribadi.

Aturan keras:
- Ikuti skema JSON berikut persis; keluarkan HANYA JSON, tanpa teks lain.
- Umur 3-7, difficulty 1-3, prompt maks 500 karakter, explanation maks 1000.
- correct_answer harus valid untuk interaction_type yang dipilih
  (lihat kontrak di CONTENT-SPEC §7.2).
- area_code/skill_code hanya boleh dari daftar ini:
{DAFTAR_SKILL}
- Jangan isi field content_origin; sistem akan menandainya sendiri.

Skema:
{
  "schema_version": 1,
  "model": "<nama model>",
  "prompt_version": "v1",
  "drafts": [
    {
      "area_code": "numbers",
      "skill_code": "count_1_5",
      "prompt": "...",
      "interaction_type": "COUNT_OBJECTS",
      "target_age_min": 3,
      "target_age_max": 5,
      "difficulty": 1,
      "correct_answer": { ... },
      "explanation": "...",
      "sources": []
    }
  ]
}
```

## 6. Contoh batch

```json
{
  "schema_version": 1,
  "model": "contoh-model",
  "prompt_version": "v1",
  "drafts": [
    {
      "area_code": "numbers",
      "skill_code": "count_1_5",
      "prompt": "Ada berapa apel?",
      "interaction_type": "COUNT_OBJECTS",
      "target_age_min": 3,
      "target_age_max": 5,
      "difficulty": 1,
      "correct_answer": {
        "type": "count_objects",
        "objects": [{ "id": "obj-1", "visualKey": "apple", "count": 3 }],
        "correctAnswer": 3,
        "maxAnswer": 3
      },
      "explanation": "Ada tiga apel."
    },
    {
      "area_code": "shapes",
      "skill_code": "primary_color",
      "prompt": "Mana yang berwarna merah?",
      "interaction_type": "TAP_ANSWER",
      "target_age_min": 3,
      "target_age_max": 4,
      "difficulty": 1,
      "correct_answer": {
        "type": "tap_answer",
        "items": [
          { "id": "opt-1", "label": "Merah", "isCorrect": true },
          { "id": "opt-2", "label": "Biru", "isCorrect": false },
          { "id": "opt-3", "label": "Kuning", "isCorrect": false }
        ]
      },
      "explanation": "Merah adalah warna primer."
    }
  ]
}
```

## 7. Cara mengirim

```bash
curl -X POST http://localhost:4321/api/reviewer/aktivitas/import \
  -H 'content-type: application/json' \
  -b 'edu_reviewer_session=<sesi reviewer>' \
  --data-binary @draf-batch.json
```

- Berhasil → `200` `{ ok, imported, activityIds, contentOrigin: "AI_DRAFT",
  reviewStatus: "DRAFT", message }`.
- Batch rusak/tak dikenal → `400 DRAFT_BATCH_INVALID` dengan pesan bernomor draf.
- Tanpa sesi reviewer → `401 UNAUTHENTICATED` (middleware, VRD 11.1).
- Lintas asal → `403 CROSS_ORIGIN`; melebihi kuota tulis → `429 RATE_LIMITED`.
- Batas body: 512 KB per batch.

Lanjutan alur: buka `/reviewer/aktivitas`, periksa tiap draf (checklist per
aktivitas di CONTENT-SPEC), lalu **Kirim untuk review** → QA → terbitkan.
