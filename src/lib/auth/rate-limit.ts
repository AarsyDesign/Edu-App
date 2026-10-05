/**
 * Rate limiting endpoint autentikasi (VRD 3.9).
 *
 * Keputusan (menjawab OQ 8): penghitung **per alamat klien + endpoint di
 * memori proses** dengan jendela tetap. PRD §19 menuntut satu deployable
 * tanpa Redis/queue, dan aplikasi ini berjalan sebagai satu proses — tabel
 * database baru hanya perlu bila kelak prosesnya banyak. Konsekuensi yang
 * diterima: penghitung hilang saat proses restart dan berlaku per proses.
 *
 * Kunci memakai `context.clientAddress` dari adapter (alamat soket). Header
 * `X-Forwarded-For` sengaja TIDAK dipercaya: tanpa keputusan deployment
 * (OQ 2) tidak ada proxy tepercaya, dan mempercayainya membuat pembatas bisa
 * dilewati dengan mengirim header palsu. Batas ini "basic" sesuai VRD 3.9 —
 * perlindungan terhadap credential stuffing dari satu sumber, bukan anti-DDoS.
 *
 * Kunci diberi prefiks endpoint supaya percobaan login tidak menghabiskan
 * kuota registrasi (dan sebaliknya).
 */
export const RATE_LIMIT_MESSAGES = {
  tooMany: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
} as const;

export interface RateLimitRule {
  /** Jumlah permintaan yang diizinkan per jendela. */
  max: number;
  /** Panjang jendela dalam milidetik. */
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Detik sampai jendela berikutnya (0 bila diizinkan). */
  retryAfterSec: number;
  /** Sisa kuota setelah permintaan ini (0 bila ditolak). */
  remaining: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Default disengaja longgar: keluarga di belakang satu NAT tidak terblokir. */
export const RATE_LIMIT_DEFAULTS = {
  windowMin: 15,
  loginMax: 15,
  registerMax: 15,
} as const;

export function rateLimitWindowMs(): number {
  return envInt("RATE_LIMIT_WINDOW_MIN", RATE_LIMIT_DEFAULTS.windowMin) * 60_000;
}

export function loginRateRule(): RateLimitRule {
  return {
    max: envInt("RATE_LIMIT_LOGIN_MAX", RATE_LIMIT_DEFAULTS.loginMax),
    windowMs: rateLimitWindowMs(),
  };
}

export function registerRateRule(): RateLimitRule {
  return {
    max: envInt("RATE_LIMIT_REGISTER_MAX", RATE_LIMIT_DEFAULTS.registerMax),
    windowMs: rateLimitWindowMs(),
  };
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

/** Batas jumlah kunci di memori; lewat itu entri kedaluwarsa dibuang dulu. */
const MAX_KEYS = 5000;

function prune(now: number): void {
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}

/**
 * Pakai satu kuota untuk `key`. Melewati `rule.max` dalam satu jendela =
 * ditolak sampai jendela berikutnya (`retryAfterSec`).
 */
export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitVerdict {
  let entry = windows.get(key);

  if (entry === undefined) {
    if (windows.size >= MAX_KEYS) prune(now);
    if (windows.size >= MAX_KEYS) {
      // Darurat: buang kunci tertua (Map menjaga urutan sisipan) supaya
      // memori tetap terbatas walau serangan memutar kunci.
      const oldest = windows.keys().next();
      if (!oldest.done) windows.delete(oldest.value);
    }
    entry = { count: 0, resetAt: now + rule.windowMs };
    windows.set(key, entry);
  } else if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + rule.windowMs;
  }

  entry.count += 1;
  const allowed = entry.count <= rule.max;
  return {
    allowed,
    retryAfterSec: allowed
      ? 0
      : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    remaining: Math.max(0, rule.max - entry.count),
  };
}

/** Kunci klien dari konteks handler. `clientAddress` adapter bisa melempar
 *  bila adapter tidak mendukung — jatuh ke `"unknown"` (dibatasi juga). */
export function clientKey(context: { clientAddress?: string } | undefined): string {
  try {
    const address = context?.clientAddress;
    if (typeof address === "string" && address.length > 0) return address;
  } catch {
    /* adapter tanpa alamat klien */
  }
  return "unknown";
}

/** 429 dengan `retry-after`, JSON aman, tanpa cache (VRD 3.10 tetap berlaku). */
export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({ error: "RATE_LIMITED", message: RATE_LIMIT_MESSAGES.tooMany }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "retry-after": String(Math.max(1, retryAfterSec)),
      },
    },
  );
}

/** Hanya untuk test: kosongkan seluruh penghitung. */
export function resetRateLimits(): void {
  windows.clear();
}
