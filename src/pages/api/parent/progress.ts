/**
 * Ringkasan progres orang tua (VRD 9.8).
 *
 * GET /api/parent/progress?child=<uuid>[&window=<1..50>]
 *   → { child: { childId, nickname, age }, progress: ParentProgressSummary }
 *
 * Keamanan: berada di prefix `/api/parent` yang dijaga middleware (VRD 3.5)
 * + `parentIdOf()` (VRD 3.8) + `getChildForParent` (VRD 3.7). Tanpa sesi →
 * 401; id rusak / tidak ada / milik orang tua lain → 404 dengan badan identik
 * (anti-enumerasi). Profil terarsip tetap bisa dibaca ringkasannya — riwayat
 * anak yang sudah diarsip milik orang tua itu juga, arsip hanya menyembunyikan
 * profil dari alur belajar.
 *
 * Isi respons murni fakta (angka + id + waktu): tanpa label lulus/gagal/
 * peringkat (VRD 9.6/9.7) dan tanpa `parentAccountId` (minimisasi data).
 * Tidak ada UI di run ini — baris ringkasannya baru dirender bersama Phase 10.1.
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { getChildForParent } from "../../../lib/auth/guard.ts";
import { errorResponse, jsonResponse } from "../../../lib/auth/http.ts";
import { getParentProgressSummary } from "../../../lib/progress/summary.ts";
import { RECENT_WINDOW_MAX } from "../../../lib/progress/engine.ts";

export const GET: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const childId = context.url.searchParams.get("child");
  if (!childId) {
    return errorResponse(400, "BAD_REQUEST", "Parameter child diperlukan");
  }

  // Jendela "performa terkini" — di luar 1..50 dibiarkan jatuh ke bawaan
  // di dalam engine (bukan nol, bukan galat): nilai buruk tidak mengubah
  // makna ringkasan.
  const rawWindow = context.url.searchParams.get("window");
  let window: number | undefined;
  if (rawWindow !== null && rawWindow !== "") {
    const parsed = Number(rawWindow);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= RECENT_WINDOW_MAX) {
      window = parsed;
    }
  }

  const db = await getDb();
  const child = await getChildForParent(db, childId, parentId);
  if (!child) {
    return errorResponse(404, "NOT_FOUND", "Profil anak tidak ditemukan");
  }

  const progress = await getParentProgressSummary(db, child, { window });
  return jsonResponse({
    child: { childId: child.childId, nickname: child.nickname, age: child.age },
    progress,
  });
};
