/**
 * Tipe MATCH — ketuk item kiri lalu item kanan (atau seret) untuk memasangkan.
 * Pasangan yang terbentuk dikirim utuh ke server untuk dinilai.
 */
import { getRoot, submitAnswer } from "./runtime.js";

export function initMatch(activityId, _correctPairs) {
  const root = getRoot(activityId);
  if (!root) return;
  const submit = root.querySelector(".btn-submit");
  const leftItems = [...root.querySelectorAll(".match-item.left")];
  const rightItems = [...root.querySelectorAll(".match-item.right")];
  if (!submit) return;

  const pairs = {};
  let selectedLeft = null;

  const render = () => {
    for (const el of leftItems) {
      const paired = el.dataset.id in pairs;
      const selected = !paired && el === selectedLeft;
      if (selected) el.setAttribute("data-selected", "true");
      else el.removeAttribute("data-selected");
      if (paired) el.setAttribute("data-paired", "true");
      else el.removeAttribute("data-paired");
      el.setAttribute("aria-pressed", String(el === selectedLeft));
    }
    for (const el of rightItems) {
      const paired = Object.values(pairs).includes(el.dataset.id);
      if (paired) el.setAttribute("data-paired", "true");
      else el.removeAttribute("data-paired");
    }
  };

  const assign = (leftId, rightId) => {
    if (!leftId || !rightId) return;
    delete pairs[Object.keys(pairs).find((k) => pairs[k] === rightId) ?? ""];
    pairs[leftId] = rightId;
    selectedLeft = null;
    render();
  };

  for (const el of leftItems) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-pressed", "false");
    const pick = () => {
      if (el.dataset.id in pairs) delete pairs[el.dataset.id];
      selectedLeft = el === selectedLeft ? null : el;
      render();
    };
    el.addEventListener("click", pick);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pick();
      }
    });
    el.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", el.dataset.id ?? "");
    });
  }

  for (const el of rightItems) {
    el.addEventListener("click", () => assign(selectedLeft?.dataset.id, el.dataset.id));
    el.addEventListener("dragover", (event) => event.preventDefault());
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      assign(event.dataTransfer?.getData("text/plain"), el.dataset.id);
    });
  }

  submit.addEventListener("click", () => submitAnswer(activityId, { ...pairs }));
  render();
}
