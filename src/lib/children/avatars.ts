/**
 * Katalog avatar non-hidup (PRD §8: "Optional non-living avatar").
 *
 * Satu sumber kebenaran untuk kunci yang diterima server. Katalog mengikuti
 * daftar ilustrasi DESIGN.md (bintang, buku, bulan, lentera) dan sudah dipakai
 * di UI profil anak sejak 2026-10-06 — `ChildProfileForm` (pilihan) dan
 * `ChildProfileCard` (tampilan); test membandingkan ketiganya supaya tidak
 * menyimpang. Menutup OQ 15: validasi keanggotaan katalog kini ada di server,
 * bukan hanya di UI.
 *
 * Modul sengaja tanpa dependensi (tanpa db, tanpa auth) sehingga bisa diimpor
 * oleh UI, endpoint, dan test apa pun tanpa efek samping.
 */
export const AVATAR_CATALOG = [
  { key: "star", label: "Bintang" },
  { key: "moon", label: "Bulan" },
  { key: "book", label: "Buku" },
  { key: "lantern", label: "Lentera" },
] as const;

export type AvatarKey = (typeof AVATAR_CATALOG)[number]["key"];

const KEYS: ReadonlySet<string> = new Set(AVATAR_CATALOG.map((opt) => opt.key));

/** Daftar kunci katalog (urut definisi) — dipakai gerbang konsistensi UI. */
export const AVATAR_KEYS: readonly string[] = AVATAR_CATALOG.map((opt) => opt.key);

/** true bila kunci termasuk katalog motif non-hidup. */
export function isAvatarKey(value: string): value is AvatarKey {
  return KEYS.has(value);
}
