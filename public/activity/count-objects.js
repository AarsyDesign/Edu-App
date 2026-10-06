/** Tipe COUNT_OBJECTS — isi angka lalu tekan Jawab. Angka dinilai server. */
import { getRoot, submitAnswer } from "./runtime.js";

export function initCountObjects(activityId, _correctAnswer) {
  const root = getRoot(activityId);
  if (!root) return;
  const input = root.querySelector("#count-answer");
  const button = root.querySelector(".btn-submit");
  if (!input || !button) return;

  const submit = () => {
    if (input.value.trim() === "") {
      input.required = true;
      input.reportValidity();
      input.focus();
      return;
    }
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) {
      input.reportValidity();
      return;
    }
    submitAnswer(activityId, { count: value });
  };

  button.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
}
