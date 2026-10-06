/**
 * Runtime layar aktivitas anak (VRD 7.6/7.7).
 *
 * Tugas: menilai lewat server (VRD 6.9) — klien hanya mengumpulkan jawaban,
 * menampilkan umpan balik, dan menutup sesi. Tidak ada penilaian di klien,
 * tanpa label kelulusan/kegagalan, status selalu disertai teks (bukan warna
 * saja).
 *
 * Konfigurasi dibaca dari <script type="application/json" id="activity-config">
 * yang ditanam halaman SSR (childId, sessionId, nextUrl, areaUrl).
 */

const PROGRESS_CIRCUMFERENCE = 125.6;
let busy = false;
let startedAt = Date.now();

export function readConfig() {
  const el = document.getElementById("activity-config");
  if (!el) throw new Error("Konfigurasi aktivitas tidak ditemukan");
  return JSON.parse(el.textContent || "{}");
}

export function getRoot(activityId) {
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(activityId) : activityId;
  return document.querySelector(`.activity-root[data-activity-id="${escaped}"]`);
}

/** Perbarui cincin kemajuan (persentase + teks + aria). */
export function setProgress(root, percent) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = root.querySelector(".progress-fill");
  const text = root.querySelector(".progress-text");
  const ring = root.querySelector(".progress-ring");
  if (fill) fill.style.strokeDashoffset = String(PROGRESS_CIRCUMFERENCE * (1 - pct / 100));
  if (text) text.textContent = `${pct}%`;
  if (ring) ring.setAttribute("aria-valuenow", String(pct));
}

function interactionControls(root, disabled) {
  const scope = root.querySelector(".activity-interaction");
  if (!scope) return;
  for (const el of scope.querySelectorAll("button, input")) {
    el.disabled = disabled;
  }
}

/** Pesan status singkat di dalam area jawaban (role=status, bukan warna saja). */
export function showNotice(root, message) {
  const scope = root.querySelector(".activity-interaction");
  if (!scope) return;
  let notice = scope.querySelector(".notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.className = "notice";
    notice.setAttribute("role", "status");
    scope.prepend(notice);
  }
  notice.textContent = message;
}

function clearNotice(root) {
  root.querySelector(".notice")?.remove();
}

function buildFeedbackContent(data) {
  const wrap = document.createElement("div");
  const status = document.createElement("p");
  status.className = "feedback-status";
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = data.correct ? "✓" : "✗";
  status.append(mark, document.createTextNode(data.correct ? "Benar!" : "Belum tepat."));
  wrap.appendChild(status);

  const explanation = document.createElement("p");
  explanation.className = "feedback-explanation";
  explanation.textContent = data.explanation || (data.correct ? "Tepat sekali!" : "Coba lagi ya.");
  wrap.appendChild(explanation);

  if (data.hint) {
    const hint = document.createElement("p");
    hint.className = "feedback-hint";
    hint.textContent = `Petunjuk: ${data.hint}`;
    wrap.appendChild(hint);
  }
  return wrap;
}

function showFeedback(root, data) {
  const feedback = root.querySelector(".activity-feedback");
  const content = root.querySelector(".feedback-content");
  const retry = root.querySelector(".btn-retry");
  const next = root.querySelector(".btn-next");
  if (!feedback || !content || !retry || !next) return;

  content.textContent = "";
  content.appendChild(buildFeedbackContent(data));
  feedback.dataset.state = data.correct ? "correct" : "incorrect";

  if (!feedback.querySelector(".feedback-actions")) {
    const actions = document.createElement("div");
    actions.className = "feedback-actions";
    feedback.append(actions);
  }
  const actions = feedback.querySelector(".feedback-actions");
  actions.textContent = "";
  if (!data.correct) actions.appendChild(retry);
  actions.appendChild(next);

  retry.hidden = Boolean(data.correct);
  next.hidden = false;
  feedback.hidden = false;
  feedback.focus?.();
}

function resetInteraction(root) {
  const feedback = root.querySelector(".activity-feedback");
  if (feedback) feedback.hidden = true;
  clearNotice(root);
  for (const btn of root.querySelectorAll(".option-btn")) {
    btn.setAttribute("aria-pressed", "false");
    btn.removeAttribute("data-selected");
    btn.removeAttribute("data-paired");
  }
  const input = root.querySelector("#count-answer");
  if (input) input.value = "";
  setProgress(root, 0);
  interactionControls(root, false);
  startedAt = Date.now();
  root.querySelector(".activity-interaction button, .activity-interaction input")?.focus();
}

/**
 * Kirim jawaban ke server untuk dinilai (VRD 6.9) lalu tampilkan umpan balik.
 * Gagal jaringan → pesan jujur + jawaban bisa dicoba ulang, tidak ada data
 * yang dikarang.
 */
export async function submitAnswer(activityId, answer) {
  const root = getRoot(activityId);
  if (!root || busy) return;
  const cfg = readConfig();

  busy = true;
  interactionControls(root, true);
  setProgress(root, 100);

  try {
    const res = await fetch("/api/activity/attempt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: cfg.childId,
        activityId,
        sessionId: cfg.sessionId,
        answer,
        durationMs: Date.now() - startedAt,
      }),
      credentials: "same-origin",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (body && body.error === "ACTIVITY_NOT_READY") {
        showNotice(root, "Aktivitas ini belum siap. Pilih aktivitas lain ya.");
      } else {
        showNotice(root, "Jawaban belum tersimpan. Coba sekali lagi.");
      }
      interactionControls(root, false);
      setProgress(root, 0);
      busy = false;
      return;
    }
    const data = await res.json();
    busy = false;
    showFeedback(root, data);
  } catch {
    busy = false;
    interactionControls(root, false);
    setProgress(root, 0);
    showNotice(root, "Tersambungnya terputus. Jawaban belum tersimpan, coba lagi.");
  }
}

/** Tutup sesi (VRD 7.7) lalu pindah halaman — tetap jalan saat jaringan lemah. */
export function leaveSession(targetUrl) {
  const cfg = readConfig();
  const done = () => {
    window.location.assign(targetUrl);
  };
  try {
    fetch("/api/session/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: cfg.sessionId, childId: cfg.childId }),
      credentials: "same-origin",
      keepalive: true,
    })
      .catch(() => {})
      .then(done, done);
  } catch {
    done();
  }
}

/** Sambungkan tombol navigasi + keadaan halaman (dipanggil halaman SSR). */
export function initActivityChrome() {
  const root = document.querySelector(".activity-root");
  if (!root) return;
  const cfg = readConfig();

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("reduce-motion");
  }
  startedAt = Date.now();
  setProgress(root, 0);

  root.querySelector(".btn-home")?.addEventListener("click", () => {
    leaveSession(`/learn?child=${encodeURIComponent(cfg.childId)}`);
  });
  root.querySelector(".btn-next")?.addEventListener("click", () => {
    leaveSession(cfg.nextUrl);
  });
  root.querySelector(".btn-retry")?.addEventListener("click", () => {
    resetInteraction(root);
  });
  for (const link of document.querySelectorAll("[data-leave-session]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      leaveSession(link.getAttribute("href"));
    });
  }
}
