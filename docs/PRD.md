# PRD — Aplikasi Belajar Anak 3–7 Tahun
Version: 0.1 MVP
Status: Implementation Handoff
Product working name: TBD

## 0. Executive Summary

Produk ini adalah aplikasi belajar interaktif untuk anak usia 3–7 tahun. MVP berfokus pada pengalaman belajar yang aman, tenang, colorful, playful, dan tidak bergantung pada karakter makhluk hidup atau musik yang dominan.

Prinsip inti:
1. Anak belajar melalui aktivitas interaktif singkat.
2. Usia menentukan starting point, bukan membatasi kemampuan.
3. Progress aktual menentukan rekomendasi berikutnya.
4. Konten awal dapat dibantu AI untuk drafting, tetapi setiap konten yang masuk production wajib melalui human review.
5. Tidak ada AI-generated question yang dipublikasikan mentah.
6. Parent adalah account owner; child profile berada di bawah parent.
7. Data anak diminimalkan.
8. Child mode tidak memiliki social/community interaction.
9. Visual menggunakan objek, bentuk, pola, buku, alat belajar, arsitektur, dan motif geometris; tidak menggunakan karakter manusia/hewan pada MVP.
10. Audio minimal; musik OFF by default.
11. Produk tidak mengejar gamification yang membuat anak kecanduan; reward berfokus pada progress belajar.
12. Arsitektur harus memungkinkan pengembangan ke community question bank di masa depan tanpa mencampur child social experience dengan community layer.

## 1. Problem

Orang tua membutuhkan screen time yang lebih bermakna untuk anak. Banyak aplikasi anak terlalu ramai, terlalu game-like, atau terlalu bergantung pada karakter dan stimulasi audio.

Masalah yang ingin diselesaikan:
- Anak sulit mempertahankan minat pada latihan soal statis.
- Orang tua sulit mengetahui kemampuan anak secara konkret.
- Konten belajar sering tidak adaptif terhadap kemampuan.
- Aplikasi anak sering mengumpulkan data lebih banyak daripada yang diperlukan.
- Pengalaman belajar yang tenang dan selaras dengan preferensi keluarga masih memiliki ruang untuk dibangun.

## 2. Target Users

### Primary
Anak usia 3–7 tahun.

### Secondary
Orang tua/wali yang mengatur profil dan memantau progress.

### Future
Guru, contributor, reviewer, moderator, dan komunitas pendidikan.

## 3. Age Segmentation

### 3–4 tahun — Pre-literacy
Fokus:
- counting 1–5
- warna
- bentuk
- besar/kecil
- mencocokkan
- pola sederhana
- posisi
- instruksi audio/visual pendek

Tidak mengandalkan kemampuan membaca.

### 5–6 tahun — Early literacy
Fokus:
- angka 1–10/20
- counting
- letter recognition
- kata sederhana
- klasifikasi
- pola
- ukuran
- logika dasar
- adab dasar

### 6–7 tahun — Early elementary
Fokus:
- tambah/kurang sederhana
- membaca kalimat pendek
- vocabulary
- logika
- urutan
- pengetahuan umum
- Bahasa Inggris dasar
- pendidikan Islam dasar

Age = initial placement only. Performance = progression.

## 4. Learning Areas

MVP:
1. Angka & Berhitung
2. Huruf & Bahasa
3. Logika
4. Bentuk & Warna
5. Mengenal Dunia
6. Adab & Islam

Mata pelajaran formal bukan struktur utama untuk usia 3–7 tahun.

## 5. MVP Content Target

Target awal: 100 aktivitas, bukan sekadar 100 pertanyaan teks.

Suggested distribution:
- Angka & Berhitung: 25
- Huruf & Bahasa: 20
- Logika: 20
- Bentuk & Warna: 15
- Mengenal Dunia: 10
- Adab & Islam: 10

Semua konten melewati:
AI draft -> human review -> correction -> QA -> publish.

## 6. Question / Activity Types

MVP:
- Tap Answer
- Count Objects
- Match
- Sort
- Sequence
- Identify Color
- Identify Shape
- Simple Multiple Choice
- Simple True/False only where developmentally appropriate

Setiap activity memiliki:
- id
- learning_area
- target_age_min
- target_age_max
- difficulty
- prompt
- interaction_type
- options/data
- correct_answer
- explanation/feedback
- content_origin
- review_status
- reviewer
- version
- created_at
- updated_at

## 7. Content Quality

AI may draft content but cannot publish directly.

Required production states:
DRAFT -> HUMAN_REVIEW -> QA_APPROVED -> PUBLISHED
Possible exception:
PUBLISHED -> FLAGGED -> REVIEW -> UPDATED / UNPUBLISHED

Content metadata:
- HUMAN_CREATED
- AI_ASSISTED
- AI_DRAFT
- COMMUNITY_CREATED (future)
- VERIFIED (future)

For Islamic content:
- source required when factual/religious claim requires it
- source title/type
- reference detail
- methodology/context where relevant
- no unsupported religious claims
- disputed matters must not be presented as universally uncontested

## 8. Child Onboarding

Parent creates child profile.

Minimal flow:
1. Parent creates account.
2. Add child profile.
3. Child nickname.
4. Age: 3/4/5/6/7.
5. Optional non-living avatar.
6. Language.
7. Learning goals.
8. Start short baseline assessment.

Do not request:
- full legal name
- exact address
- location
- school
- phone number of child
- photo
- unnecessary birth date
- social handles

## 9. Baseline Assessment

5–10 activities maximum initially.

Goals:
- estimate starting level
- avoid making age the permanent difficulty rule
- identify strengths/weaknesses

Output:
- skill profile
- recommended starting path

Do not display comparative labels such as “stupid”, “behind”, or public ranking.

## 10. Core Child Learning Loop

Home -> choose learning journey -> activity -> answer -> immediate feedback -> next activity -> session completion -> progress update.

Target session:
5–15 minutes.

Feedback:
Correct:
- subtle animation
- star/progress
- concise positive message

Incorrect:
- no harsh red/error blast
- “Belum tepat, coba lagi.”
- optionally provide a hint
- allow retry depending on activity

## 11. Learning Journey

Use progression instead of leaderboard.

Example:
Start -> Mengenal Angka -> Menghitung -> Tambah Sederhana -> Penjelajah Angka.

Child sees:
- current path
- completed nodes
- next recommended activity
- gentle progress

No competitive leaderboard in MVP.

## 12. Parent Mode

Parent dashboard:
- child profiles
- activities completed
- session duration
- skill progress
- recommended practice
- settings
- audio preference
- session duration preference

Avoid excessive analytics in MVP.

## 13. Account Architecture

Parent account owns child profiles.

Conceptual:
Parent
  -> ChildProfile[]
  -> LearningProgress
  -> Settings

Child mode is restricted:
- no public profile
- no chat
- no community comments
- no external links without parent gate
- no purchases without parent gate

Future community contributor/reviewer accounts must be separated from child learning identity.

## 14. Privacy & Safety

Privacy by minimization.

Security requirements:
- secure authentication
- encrypted transport
- server-side authorization
- no client-trusted parent permissions
- child data scoped to parent tenant
- no public child data
- audit sensitive parent actions
- parent gate for external navigation and purchases
- configurable retention/deletion strategy

Do not use child behavioral data for advertising in MVP.

## 15. Visual Direction

Theme:
Islamic-inspired, calm, colorful, premium, playful.

Avoid:
- human characters
- animal characters
- excessive gradients
- excessive glassmorphism
- noisy dashboards
- constant motion
- loud music
- generic “AI kids app” aesthetic
- visual clutter

Allowed visual language:
- geometric Islamic patterns
- stars
- moon
- books
- pencils
- numbers
- letters
- geometric shapes
- clouds
- architecture
- lanterns
- abstract mascots made only from non-living geometric objects if needed

Animation:
micro-interactions, generally 200–700ms; no perpetual motion.

Audio:
OFF by default for music.
Short optional sound effects.
Voice instruction may be used when useful for pre-literacy activities.

## 16. Accessibility / UX

- large touch targets
- high contrast
- simple language
- one primary action per screen
- minimal text for younger ages
- no critical information communicated only by color
- reduced-motion preference
- audio controls
- retry without punishment

## 17. Monetization Direction

MVP does not need monetization.

Long-term:
Free:
- core learning
- public learning content
- basic progress

Potential paid:
- advanced parent analytics
- teacher tools
- private question banks
- classroom
- assignment/exam tools
- institutional workspace

Donation:
- optional support for keeping educational content accessible

Do not gate basic learning behind payment in MVP.

## 18. Future Community Expansion

Future system:
Human creates question -> community uses -> review -> evidence/discussion -> correction -> verified -> revision history -> contributor reputation.

Do not expose this social layer to young children.

Future contributor/reviewer roles:
- Contributor
- Reviewer
- Trusted Reviewer
- Moderator

Discussion should be evidence-oriented, not like social media.

## 19. Technical Architecture Direction

Architecture should remain implementation-flexible for MVP.

Recommended conceptual layers:
1. Client/UI
2. Authentication
3. Parent/child profile service
4. Content service
5. Learning/progress service
6. Review/QA content service
7. Analytics/event layer
8. Storage
9. Database

Recommended initial deployment principle:
- single deployable application
- managed PostgreSQL where practical
- object storage only when media is needed
- avoid microservices
- avoid Kubernetes
- avoid unnecessary queues/Redis/search clusters
- keep AI content generation outside the child runtime path

PWA/Web is a viable first client; Flutter remains a future option. Backend contracts must not depend on a specific client.

## 20. Non-Goals for MVP

- public social network
- child-to-child chat
- leaderboard
- marketplace
- complex AI tutor
- AI-generated content published automatically
- school administration
- payment gateway
- community moderation system
- public creator profiles
- massive content catalog
- multi-tenant institutional SaaS

## 21. MVP Success Metrics

Primary:
- activation: parent creates child and starts first activity
- first-session completion
- repeat learning sessions
- activity completion rate
- retry rate
- parent return rate

Learning/content:
- error distribution by skill
- content flag rate
- content correction rate
- content completion quality

Do not optimize solely for session duration.

## 22. Acceptance Criteria

MVP is acceptable when:
- parent can create account and child profile
- age maps to appropriate initial level
- child can complete activities without reading-heavy UI
- activities give immediate feedback
- progress persists correctly
- parent can see basic progress
- content can be created/imported through an admin/content workflow
- AI-drafted content cannot bypass review status
- no child profile is publicly exposed
- core app works on a modern mobile/tablet browser
- app remains usable with audio disabled
- visual implementation follows DESIGN-SYSTEM.md
- no obvious template/slop patterns remain after visual QA

## 23. Definition of Done

A feature is not done until:
1. functional behavior works
2. validation exists
3. authorization is server-side
4. loading/error/empty states exist
5. mobile/tablet layout is tested
6. accessibility basics are checked
7. analytics events are intentional
8. content is reviewed
9. visual QA passes
10. regression tests pass
