/**
 * Tipe SEQUENCE — ketuk item sesuai urutan yang diinginkan (item pindah ke
 * akhir daftar), lalu tekan Selesai. Urutan dikirim ke server untuk dinilai.
 */
import { getRoot, submitAnswer } from "./runtime.js";

export function initSequence(activityId, _orderIds) {
  const root = getRoot(activityId);
  if (!root) return;
  const track = root.querySelector(".sequence-track");
  const submit = root.querySelector(".btn-submit");
  if (!track || !submit) return;

  const items = [...track.children];
  for (const item of items) {
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", `${item.textContent?.trim() ?? "item"} — ketuk untuk memindahkan ke akhir urutan`);

    const moveToEnd = () => {
      track.appendChild(item);
      item.focus();
    };
    item.addEventListener("click", moveToEnd);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        moveToEnd();
      }
    });
  }

  submit.addEventListener("click", () => {
    const order = [...track.children].map((el) => el.dataset.id ?? "");
    submitAnswer(activityId, order);
  });
}
