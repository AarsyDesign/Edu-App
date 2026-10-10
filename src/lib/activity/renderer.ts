/**
 * Activity Renderer — VRD Phase 6.13 (type-driven)
 *
 * Single entry point that renders any activity type based on ActivityRenderInput.
 * Uses DESIGN.md tokens only — no hardcoded visual values.
 */

import type {
  ActivityRenderInput,
  ActivityData,
  ActivityType,
  TapAnswerData,
  CountObjectsData,
  MatchData,
  SequenceData,
  IdentifyColorData,
  IdentifyShapeData,
  MultipleChoiceData,
  TrueFalseData,
} from "./domain.ts";
import { validateAnswer, COUNT_MAX_PER_GROUP, VISUAL_KEY_RE, type ValidationResult } from "./domain.ts";

// ============================================================
// Renderer Registry (maps type to render function)
// ============================================================

type RenderFn = (input: ActivityRenderInput) => string;

const renderers: Partial<Record<ActivityType, RenderFn>> = {};

// ============================================================
// Base Layout (shared by all activities)
// ============================================================

function baseLayout(input: ActivityRenderInput, innerHtml: string): string {
  const { activityId, childAge, audioEnabled, reducedMotion } = input;
  const motionClass = reducedMotion ? "reduced-motion" : "";
  const audioClass = audioEnabled ? "audio-on" : "audio-off";

  return `
<article
  class="activity-root ${motionClass} ${audioClass}"
  data-activity-id="${activityId}"
  data-activity-type="${input.type}"
  data-child-age="${childAge}"
>
  <header class="activity-header">
    <div class="progress-ring" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Kemajuan aktivitas">
      <svg class="progress-svg" viewBox="0 0 48 48">
        <circle class="progress-bg" cx="24" cy="24" r="20" fill="none" stroke="var(--c-sage)" stroke-width="4"/>
        <circle class="progress-fill" cx="24" cy="24" r="20" fill="none" stroke="var(--c-success)" stroke-width="4" stroke-dasharray="125.6" stroke-dashoffset="125.6" stroke-linecap="round"/>
      </svg>
      <span class="progress-text">0%</span>
    </div>
  </header>

  <main class="activity-main">
    <section class="activity-prompt" aria-live="polite">
      <h1 class="prompt-text">${escapeHtml(input.prompt)}</h1>
    </section>

    <section class="activity-interaction" role="region" aria-label="Area jawaban">
      ${innerHtml}
    </section>

    <section class="activity-feedback" aria-live="polite" hidden>
      <div class="feedback-content"></div>
      <button class="btn btn-retry" hidden>Coba Lagi</button>
      <button class="btn btn-next" hidden>Aktivitas Berikutnya</button>
    </section>
  </main>

  <footer class="activity-footer">
    <button class="btn btn-tertiary btn-home" type="button">Beranda</button>
  </footer>
</article>
`;
}

// ============================================================
// Utility
// ============================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Serialisasi aman untuk <script type="module">. `JSON.stringify` sendiri
 * tidak menetralkan `<`, sehingga id/konten berisi `</script>` bisa keluar
 * dari blok skrip dan menyuntik markup baru ke layar anak. Pola yang sama
 * dipakai halaman aktivitas (`configJson`) dan ActivityEditorForm.
 */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Tombol pilihan. `labelHtml` dipakai bila label sudah berisi markup siap
 * pakai (mis. swatch warna) — HTML semacam itu wajib disusun di sini, bukan
 * dari teks konten mentah, supaya tidak ada yang lolos tanpa di-escape.
 */
function generateOptionButton(
  option: { id: string; label: string },
  isSelected: boolean,
  index: number,
  labelHtml = false,
): string {
  const label = labelHtml ? option.label : escapeHtml(option.label);
  return `
<button
  class="option-btn ${isSelected ? "selected" : ""}"
  type="button"
  data-option-id="${escapeHtml(option.id)}"
  data-option-index="${index}"
  aria-pressed="${isSelected}"
>
  <span class="option-label">${label}</span>
</button>
`;
}

/**
 * Nilai warna CSS dari konten hanya diterima bila berupa heksa valid —
 * payload konten tidak boleh menuliskan CSS bebas ke halaman.
 */
function safeHexColor(value: unknown): string | null {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
    ? value
    : null;
}

// ============================================================
// Tap Answer Renderer (VRD 6.2)
// ============================================================

function renderTapAnswer(input: ActivityRenderInput): string {
  const data = input.data as TapAnswerData;
  const itemsHtml = data.items
    .map((item, idx) => generateOptionButton({ id: item.id, label: item.label }, false, idx))
    .join("");

  return `
<div class="tap-answer-grid" role="group" aria-label="Pilih jawaban yang benar">
  ${itemsHtml}
</div>
<script type="module">
import { initTapAnswer } from "/activity/tap-answer.js";
initTapAnswer(${jsonForScript(input.activityId)}, ${jsonForScript(data.items.map(i => i.id))}, ${jsonForScript(data.items.find(i => i.isCorrect)?.id ?? "")});
</script>
`;
}

renderers.TAP_ANSWER = renderTapAnswer;

// ============================================================
// Count Objects Renderer (VRD 6.3) - stub
// ============================================================

function renderCountObjects(input: ActivityRenderInput): string {
  const data = input.data as CountObjectsData;
  const objectsHtml = data.objects
    .map((obj) => {
      // Gambar `count` titik per kelompok — sebelumnya hanya satu titik
      // per kelompok sehingga anak diminta menghitung lima bintang tetapi
      // layar hanya menampilkan dua (temuan QA E2E tipe aktivitas).
      const count =
        Number.isInteger(obj.count) && obj.count > 0
          ? Math.min(obj.count, COUNT_MAX_PER_GROUP)
          : 0;
      // Kunci visual divalidasi ulang di sini (bukan hanya di validator):
      // string ini menjadi nama kelas di markup layar anak.
      const visualClass = VISUAL_KEY_RE.test(obj.visualKey ?? "")
        ? `visual-${obj.visualKey}`
        : "visual";
      const dots = Array.from({ length: count }, () => `<span class="${visualClass}"></span>`).join("");
      return `<div class="count-object" data-count="${count}">${dots}</div>`;
    })
    .join("");

  return `
<div class="count-objects-area">
  <div class="objects-display">${objectsHtml}</div>
  <div class="number-input">
    <label for="count-answer" class="sr-only">Jumlah objek</label>
    <input type="number" id="count-answer" min="0" max="${data.maxAnswer ?? 20}" inputmode="numeric" autocomplete="off" />
    <button class="btn btn-primary btn-submit" type="button">Jawab</button>
  </div>
</div>
<script type="module">
import { initCountObjects } from "/activity/count-objects.js";
initCountObjects(${jsonForScript(input.activityId)}, ${jsonForScript(data.correctAnswer)});
</script>
`;
}

renderers.COUNT_OBJECTS = renderCountObjects;

// ============================================================
// Match Renderer (VRD 6.4) - stub
// ============================================================

function renderMatch(input: ActivityRenderInput): string {
  const data = input.data as MatchData;
  const leftHtml = data.left.map((l, i) => `<div class="match-item left" data-id="${escapeHtml(l.id)}" draggable="true"><span>${escapeHtml(l.label)}</span></div>`).join("");
  const rightHtml = data.right.map((r, i) => `<div class="match-item right" data-id="${escapeHtml(r.id)}" droppable="true"><span>${escapeHtml(r.label)}</span></div>`).join("");

  return `
<div class="match-area">
  <div class="match-column left-column" role="list" aria-label="Sisi kiri">${leftHtml}</div>
  <div class="match-column right-column" role="list" aria-label="Sisi kanan">${rightHtml}</div>
  <button class="btn btn-primary btn-submit" type="button">Selesai</button>
</div>
<script type="module">
import { initMatch } from "/activity/match.js";
initMatch(${jsonForScript(input.activityId)}, ${jsonForScript(data.correctPairs)});
</script>
`;
}

renderers.MATCH = renderMatch;

// ============================================================
// Sequence Renderer (VRD 6.5) - stub
// ============================================================

/**
 * Urutan tampil untuk SEQUENCE.
 *
 * Urutan tampil tidak boleh sama dengan urutan benar: perender menerima
 * `items` yang sudah menurut `correctPosition` (dan editor menurunkan posisi
 * dari urutan baris), sehingga tanpa pengacakan layar selalu menampilkan
 * jawaban — anak cukup mengetuk dari atas ke bawah untuk "benar" (temuan
 * QA E2E tipe aktivitas). Pengacakan memakai mulberry32 yang diseed
 * FNV-1a(activityId) supaya hasilnya deterministik per aktivitas (muat ulang
 * tidak mengubah tampilan); penilaian tetap sepenuhnya di server berbasis
 * `correctPosition`.
 */
export function sequenceDisplayOrder<T extends { correctPosition: number }>(
  items: readonly T[],
  activityId: string,
): T[] {
  const display = [...items];
  let state = fnv1a32(activityId);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = display.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = display[i];
    display[i] = display[j] as T;
    display[j] = swap;
  }
  // Kalau hasil acak kebetulan sama dengan urutan benar (mungkin untuk
  // panjang kecil), geser satu langkah — jawaban tidak pernah tampil lurus.
  if (display.length > 1 && display.every((item, index) => item.correctPosition === index)) {
    display.push(display.shift() as T);
  }
  return display;
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function renderSequence(input: ActivityRenderInput): string {
  const data = input.data as SequenceData;
  const displayItems = sequenceDisplayOrder(data.items, input.activityId);
  const itemsHtml = displayItems
    .map((item) => `<div class="sequence-item" data-id="${escapeHtml(item.id)}" draggable="true"><span class="seq-label">${escapeHtml(item.label)}</span></div>`)
    .join("");

  return `
<div class="sequence-area">
  <div class="sequence-track" role="list" aria-label="Susun urutan">${itemsHtml}</div>
  <button class="btn btn-primary btn-submit" type="button">Selesai</button>
</div>
<script type="module">
import { initSequence } from "/activity/sequence.js";
initSequence(${jsonForScript(input.activityId)}, ${jsonForScript(displayItems.map((i) => i.id))});
</script>
`;
}

renderers.SEQUENCE = renderSequence;

// ============================================================
// Identify Color Renderer (VRD 6.6) - stub
// ============================================================

function renderIdentifyColor(input: ActivityRenderInput): string {
  const data = input.data as IdentifyColorData;
  const optionsHtml = data.options
    .map((opt, idx) => {
      const hex = safeHexColor(opt.colorValue);
      const swatch = hex
        ? `<span class="color-swatch" style="background:${hex}"></span>`
        : `<span class="color-swatch"></span>`;
      return generateOptionButton(
        { id: opt.id, label: `${swatch}${escapeHtml(opt.colorName)}` },
        false,
        idx,
        true,
      );
    })
    .join("");

  return `
<div class="identify-color-area">
  <p class="color-target">Cari warna <strong>${escapeHtml(data.targetColorName)}</strong></p>
  <div class="color-options" role="group" aria-label="Pilih warna">${optionsHtml}</div>
</div>
<script type="module">
import { initIdentifyColor } from "/activity/identify-color.js";
initIdentifyColor(${jsonForScript(input.activityId)}, ${jsonForScript(data.options.find(o => o.isCorrect)?.id ?? "")});
</script>
`;
}

renderers.IDENTIFY_COLOR = renderIdentifyColor;

// ============================================================
// Identify Shape Renderer (VRD 6.7) - stub
// ============================================================

function renderIdentifyShape(input: ActivityRenderInput): string {
  const data = input.data as IdentifyShapeData;
  const optionsHtml = data.options
    .map((opt, idx) =>
      generateOptionButton(
        { id: opt.id, label: `<span class="shape-icon shape-${escapeHtml(opt.shapeKey)}" aria-hidden="true"></span>${escapeHtml(opt.shapeName)}` },
        false,
        idx,
        true,
      ),
    )
    .join("");

  return `
<div class="identify-shape-area">
  <p class="shape-target">Cari bentuk <strong>${escapeHtml(data.targetShapeName)}</strong></p>
  <div class="shape-options" role="group" aria-label="Pilih bentuk">${optionsHtml}</div>
</div>
<script type="module">
import { initIdentifyShape } from "/activity/identify-shape.js";
initIdentifyShape(${jsonForScript(input.activityId)}, ${jsonForScript(data.options.find(o => o.isCorrect)?.id ?? "")});
</script>
`;
}

renderers.IDENTIFY_SHAPE = renderIdentifyShape;

// ============================================================
// Multiple Choice Renderer (VRD 6.8) - stub
// ============================================================

function renderMultipleChoice(input: ActivityRenderInput): string {
  const data = input.data as MultipleChoiceData;
  const optionsHtml = data.options
    .map((opt, idx) => generateOptionButton({ id: opt.id, label: opt.label }, false, idx))
    .join("");

  return `
<div class="multiple-choice-area">
  <p class="mc-question">${escapeHtml(data.question)}</p>
  <div class="mc-options" role="group" aria-label="Pilih jawaban">${optionsHtml}</div>
  <button class="btn btn-primary btn-submit" type="button">Jawab</button>
</div>
<script type="module">
import { initMultipleChoice } from "/activity/multiple-choice.js";
initMultipleChoice("${input.activityId}", ${JSON.stringify(data.options.filter(o => o.isCorrect).map(o => o.id))});
</script>
`;
}

renderers.MULTIPLE_CHOICE = renderMultipleChoice;

// ============================================================
// True/False Renderer (VRD 6.8) - stub
// ============================================================

function renderTrueFalse(input: ActivityRenderInput): string {
  const data = input.data as TrueFalseData;
  const trueLabel = data.trueLabel ?? "Benar";
  const falseLabel = data.falseLabel ?? "Salah";

  return `
<div class="true-false-area">
  <p class="tf-statement">${escapeHtml(data.statement)}</p>
  <div class="tf-options" role="group" aria-label="Pilih benar atau salah">
    ${generateOptionButton({ id: "true", label: trueLabel }, false, 0)}
    ${generateOptionButton({ id: "false", label: falseLabel }, false, 1)}
  </div>
</div>
<script type="module">
import { initTrueFalse } from "/activity/true-false.js";
initTrueFalse("${input.activityId}", ${data.correctAnswer});
</script>
`;
}

renderers.TRUE_FALSE = renderTrueFalse;

// ============================================================
// Main Render Function
// ============================================================

/** Render activity HTML for SSR or client hydration */
export function renderActivity(input: ActivityRenderInput): string {
  const renderer = renderers[input.type as keyof typeof renderers];
  if (!renderer) {
    // Fallback: show error state but don't crash
    return baseLayout(input, `
<div class="activity-error error-note" role="alert">
  <p>Tipe aktivitas <code>${input.type}</code> belum didukung.</p>
  <button class="btn btn-tertiary btn-home" type="button">Kembali ke Beranda</button>
</div>
`);
  }

  const innerHtml = renderer(input);
  return baseLayout(input, innerHtml);
}

/** Validate answer server-side (VRD 6.9) */
export function validateActivityAnswer(
  activityType: ActivityType,
  activityData: ActivityData,
  childAnswer: unknown,
): ValidationResult {
  return validateAnswer(activityType, activityData, childAnswer);
}