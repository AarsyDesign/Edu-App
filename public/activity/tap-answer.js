/** Tipe TAP_ANSWER — ketuk satu item, jawaban langsung dikirim ke server. */
import { getRoot, submitAnswer } from "./runtime.js";

export function initTapAnswer(activityId, _itemIds, _correctId) {
  const root = getRoot(activityId);
  if (!root) return;
  const buttons = [...root.querySelectorAll(".option-btn")];
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === btn));
      submitAnswer(activityId, btn.dataset.optionId ?? "");
    });
  }
}
