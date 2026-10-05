/**
 * Koleksi profil anak (VRD Phase 4).
 *
 * - GET  /api/children       → daftar profil AKTIF milik sesi berjalan (4.8:
 *                              bahan child switcher).
 * - POST /api/children       → buat profil anak (4.1–4.7).
 *
 * Seluruh rute berada di bawah prefiks terlindungi `/api/children`
 * (src/middleware.ts) sehingga sesi dicek sebelum handler dijalankan;
 * kepemilikan tetap dikunci lewat `parent_account_id` di server (VRD 3.7).
 */
import type { APIRoute } from "astro";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../../../lib/auth/http.ts";
import { childErrorResponse, parentIdOf, publicChild } from "../../../lib/children/api.ts";
import {
  createChildProfile,
  listChildrenForParent,
} from "../../../lib/children/profiles.ts";
import { getDb } from "../../../lib/db/index.ts";

export const GET: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const db = await getDb();
  const children = await listChildrenForParent(db, parentId);
  return jsonResponse({ children: children.map(publicChild) });
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) {
    return errorResponse(403, "FORBIDDEN", "Permintaan ditolak.");
  }
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const body = await readJsonBody(context.request);
  if (!body) return childErrorResponse("INVALID_INPUT");

  const db = await getDb();
  const result = await createChildProfile(db, parentId, body);
  if (!result.ok) return childErrorResponse(result.code);

  return jsonResponse({ ok: true, child: publicChild(result.value) }, 201);
};
