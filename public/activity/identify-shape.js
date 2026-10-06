/** Tipe IDENTIFY_SHAPE — ketuk bentuk yang dicari, jawaban langsung dikirim. */
import { getRoot, submitAnswer } from "./runtime.js";

export function initIdentifyShape(activityId, _correctId) {
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
