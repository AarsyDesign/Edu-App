/** Tipe MULTIPLE_CHOICE — pilih satu jawaban lalu tekan Jawab. */
import { getRoot, showNotice, submitAnswer } from "./runtime.js";

export function initMultipleChoice(activityId, _correctIds) {
  const root = getRoot(activityId);
  if (!root) return;
  const buttons = [...root.querySelectorAll(".option-btn")];
  const submit = root.querySelector(".btn-submit");
  if (!submit) return;

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const pressed = btn.getAttribute("aria-pressed") === "true";
      for (const other of buttons) other.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-pressed", String(!pressed));
    });
  }

  submit.addEventListener("click", () => {
    const selected = buttons
      .filter((btn) => btn.getAttribute("aria-pressed") === "true")
      .map((btn) => btn.dataset.optionId ?? "");
    if (selected.length === 0) {
      showNotice(root, "Pilih satu jawaban dulu ya.");
      buttons[0]?.focus();
      return;
    }
    submitAnswer(activityId, { ids: selected });
  });
}
