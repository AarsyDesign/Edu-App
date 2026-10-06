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
import { validateAnswer, type ValidationResult } from "./domain.ts";

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
      <p class="prompt-text">${escapeHtml(input.prompt)}</p>
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
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
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
initTapAnswer("${input.activityId}", ${JSON.stringify(data.items.map(i => i.id))}, ${JSON.stringify(data.items.find(i => i.isCorrect)?.id ?? "")});
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
    .map((obj) => `<div class="count-object" data-count="${obj.count}"><span class="visual-${obj.visualKey}"></span></div>`)
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
initCountObjects("${input.activityId}", ${data.correctAnswer});
</script>
`;
}

renderers.COUNT_OBJECTS = renderCountObjects;

// ============================================================
// Match Renderer (VRD 6.4) - stub
// ============================================================

function renderMatch(input: ActivityRenderInput): string {
  const data = input.data as MatchData;
  const leftHtml = data.left.map((l, i) => `<div class="match-item left" data-id="${l.id}" draggable="true"><span>${escapeHtml(l.label)}</span></div>`).join("");
  const rightHtml = data.right.map((r, i) => `<div class="match-item right" data-id="${r.id}" droppable="true"><span>${escapeHtml(r.label)}</span></div>`).join("");

  return `
<div class="match-area">
  <div class="match-column left-column" role="list" aria-label="Sisi kiri">${leftHtml}</div>
  <div class="match-column right-column" role="list" aria-label="Sisi kanan">${rightHtml}</div>
  <button class="btn btn-primary btn-submit" type="button">Selesai</button>
</div>
<script type="module">
import { initMatch } from "/activity/match.js";
initMatch("${input.activityId}", ${JSON.stringify(data.correctPairs)});
</script>
`;
}

renderers.MATCH = renderMatch;

// ============================================================
// Sequence Renderer (VRD 6.5) - stub
// ============================================================

function renderSequence(input: ActivityRenderInput): string {
  const data = input.data as SequenceData;
  const itemsHtml = data.items
    .map((item, idx) => `<div class="sequence-item" data-id="${item.id}" draggable="true"><span class="seq-label">${escapeHtml(item.label)}</span></div>`)
    .join("");

  return `
<div class="sequence-area">
  <div class="sequence-track" role="list" aria-label="Susun urutan">${itemsHtml}</div>
  <button class="btn btn-primary btn-submit" type="button">Selesai</button>
</div>
<script type="module">
import { initSequence } from "/activity/sequence.js";
initSequence("${input.activityId}", ${JSON.stringify(data.items.map(i => i.id))});
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
initIdentifyColor(${JSON.stringify(input.activityId)}, ${JSON.stringify(data.options.find(o => o.isCorrect)?.id ?? "")});
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
initIdentifyShape(${JSON.stringify(input.activityId)}, ${JSON.stringify(data.options.find(o => o.isCorrect)?.id ?? "")});
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