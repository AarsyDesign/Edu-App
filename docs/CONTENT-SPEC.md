# CONTENT-SPEC.md — Initial 100 Activity Plan

## Content Rules

- Human-readable
- Developmentally appropriate
- One learning objective per activity
- Avoid trick questions
- Avoid ambiguous illustrations
- Avoid culturally confusing examples
- Feedback must explain or guide when appropriate
- Islamic content must be reviewed carefully
- No fabricated references
- No AI content directly published

## Distribution

### 25 — Numbers & Counting
- count 1–3
- count 1–5
- count 1–10
- number recognition
- more/less
- same amount
- sequence
- simple addition with objects

### 20 — Letters & Language
- letter recognition
- initial sound where appropriate
- match letter to object
- simple vocabulary
- word-picture matching
- missing letter for older children

### 20 — Logic
- matching
- classification
- sequence
- odd-one-out where developmentally appropriate
- simple patterns
- size ordering

### 15 — Shapes & Colors
- identify primary/basic colors
- match same color
- identify circle/square/triangle/rectangle
- size
- position

### 10 — World Knowledge
- everyday objects
- home/school
- nature
- simple safety
- simple body/environment concepts without unnecessary biological detail

### 10 — Adab & Islam
- basic adab
- simple duas where verified
- recognizing mosque
- simple wudu sequence
- basic Islamic vocabulary
- manners before/after eating
- respect for parents
- cleanliness

## Review Checklist Per Activity

1. Is the learning objective clear?
2. Is the activity suitable for target age?
3. Can the child understand without excessive reading?
4. Is there only one intended answer unless explicitly designed otherwise?
5. Are distractors fair?
6. Is the visual unambiguous?
7. Is the explanation correct?
8. Is source required?
9. If source is provided, is it accurate?
10. Does it avoid unnecessary sensitive data?
11. Does it avoid depicting living beings?
12. Is wording culturally appropriate?
13. Does it work with audio muted?
14. Does it work with reduced motion?
15. Has a human reviewer approved it?

## 7. Activity Payload Conventions

Closes OQ 21 in `docs/IMPLEMENTATION-AUDIT.md`. Content for Phase 13 must be
stored in the shape described here, otherwise the activity screen shows
"Aktivitas Belum Siap" (fail-safe, VRD 6.14) instead of the activity.

Normative sources: contract `src/lib/activity/domain.ts`, mapping
`src/lib/activity/content.ts`, executable spec
`test/content-payload-conventions.test.ts`.

### 7.1 Two ways a payload is built

1. **Whole object (path 1).** `activity.correct_answer` holds a JSON object
   with a lowercase `type` key (`tap_answer`, `count_objects`, `match`,
   `sequence`, `identify_color`, `identify_shape`, `multiple_choice`,
   `true_false`). It is used as-is and must pass `validateActivityData`.
   **MATCH only works this way** — left/right sides and correct pairs cannot
   be read back from `activity_option`.
2. **Assembled from rows (path 2).** Correctness comes from
   `activity_option.is_correct`, order from `activity_option.position`
   (ascending), numeric/text answers from `activity.correct_answer`, and the
   free-text `activity.prompt` supplies `MULTIPLE_CHOICE.question` and
   `TRUE_FALSE.statement`.

If neither path yields valid data the screen shows "Aktivitas Belum Siap"
with no content leak and no 500. `activity.correct_answer` and
`activity_option.payload` are `jsonb`.

### 7.2 Per-type storage table

| Type | `activity.prompt` | `activity.correct_answer` | `activity_option` payload (by `position`) | Child answer |
|------|-------------------|---------------------------|-------------------------------------------|--------------|
| `TAP_ANSWER` | instruction | `null` (truth lives in options) | `{label, value?}` + `is_correct`, ≥2 rows, exactly 1 correct | selected option `id` |
| `COUNT_OBJECTS` | instruction | JSON number, or `{correctAnswer, maxAnswer?}` | `{visualKey, count}` ≥1 row, `is_correct` ignored | number / `{count}` |
| `MATCH` | instruction | **whole `MatchData` object (path 1, required)** | not used | `{leftId: rightId}` |
| `SEQUENCE` | instruction | `null` | `{label, visualKey?}` ≥2 rows, `is_correct` ignored; `correctPosition` = `position` | `id[]` in correct order |
| `IDENTIFY_COLOR` | instruction | `null`, or `{targetColorName}` (defaults to the correct option's `colorName`) | `{colorValue, colorName}` ≥2 rows, exactly 1 correct | selected option `id` |
| `IDENTIFY_SHAPE` | instruction | `null`, or `{targetShapeName}` | `{shapeKey, shapeName}` ≥2 rows, exactly 1 correct | selected option `id` |
| `MULTIPLE_CHOICE` | **the question (non-empty)** | `null` | `{label}` ≥2 rows, ≥1 correct | `id` or `ids[]` |
| `TRUE_FALSE` | **the statement (non-empty)**; ignored when `correct_answer` is a whole object | JSON **boolean** (path 2), or whole `TrueFalseData` (path 1, only way to set `trueLabel`/`falseLabel`) | not used | boolean / `{value}` |

### 7.3 Hard rules

- `TRUE_FALSE` accepts a JSON boolean only. Never `"false"`/`0`/`1` — the
  assembly now rejects non-booleans instead of coercing them
  (`Boolean("false") === true` would silently grade a correct child wrong),
  so a wrong type shows "Aktivitas Belum Siap". Custom labels require path 1.
- `MATCH` must use path 1; path 2 deliberately returns `null` rather than
  guessing a pairing.
- `SEQUENCE` positions must be `0..n-1` with no gaps and must match
  `position`; do not set `is_correct` on sequence rows.
- `colorValue` must be a valid hex (`#RGB`, `#RRGGBB`, or `#RRGGBBAA`); the
  renderer refuses anything else and shows an unstyled swatch instead.
- `MULTIPLE_CHOICE` and `TRUE_FALSE` need a non-empty `prompt`; option-based
  types need at least 2 rows and the correct-count rules in §7.2.
- `COUNT_OBJECTS.visualKey` must match `^[a-z0-9_-]{1,40}$` — it becomes a
  CSS class on the child screen, so free text never reaches the markup — and
  each group's `count` must be an integer `0..100`. The renderer draws
  `count` items per group, so what the child can count always matches
  `correctAnswer`.
- `SEQUENCE` presentation order is shuffled by the renderer (deterministic
  per activity) so the screen never shows items already in
  `correctPosition` order; store items in correct order as usual — grading
  still reads `correctPosition` on the server.
- The payload `type` key is written lowercase; the validator also accepts the
  enum spelling, but lowercase is the convention here.
- Content stays in DRAFT until a human review promotes it (PRD §7): these
  conventions describe storage, not publication.

### 7.4 Executable check

`test/content-payload-conventions.test.ts` encodes every fixture in
`activityTestFixtures` into row shape per the table above, rebuilds it with
`buildActivityData`, and asserts (a) the rebuilt data equals the fixture,
(b) `validateAnswer` accepts the documented correct answer and rejects a
wrong one for all 8 types, and (c) the documented failure cases return
`null`. If this test and §7.2 ever disagree, the test is the signal to fix
the doc before seeding content.
