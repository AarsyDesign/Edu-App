/**
 * Profil anak tunggal (VRD Phase 4).
 *
 * - PATCH  /api/children/:id → ubah profil (4.9).
 * - DELETE /api/children/:id → arsipkan profil (4.10, riwayat tetap ada).
 *
 * Id bukan milik sesi berjalan, id rusak, id tidak ada, dan profil terarsip
 * semuanya dijawab 404 `NOT_FOUND` dengan pesan yang sama sehingga id profil
 * anak tidak bisa dipakai untuk memastikan keberadaan data orang lain
 * (VRD 3.7, 3.11). Arsip bersifat idempoten: mengulang DELETE pada profil
 * yang sudah terarsip tetap 200.
 */
import type { APIRoute } from "astro";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../../../lib/auth/http.ts";
import { childErrorResponse, parentIdOf, publicChild } from "../../../lib/children/api.ts";
import {
  archiveChildProfile,
  updateChildProfile,
} from "../../../lib/children/profiles.ts";
import { getDb } from "../../../lib/db/index.ts";

function childIdOf(context: { params: Record<string, string | undefined> }): string {
  return context.params.id ?? "";
}

export const PATCH: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) {
    return errorResponse(403, "FORBIDDEN", "Permintaan ditolak.");
  }
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const body = await readJsonBody(context.request);
  if (!body) return childErrorResponse("INVALID_INPUT");

  const db = await getDb();
  const result = await updateChildProfile(db, childIdOf(context), parentId, body);
  if (!result.ok) return childErrorResponse(result.code);

  return jsonResponse({ ok: true, child: publicChild(result.value) });
};

export const DELETE: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) {
    return errorResponse(403, "FORBIDDEN", "Permintaan ditolak.");
  }
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const db = await getDb();
  const result = await archiveChildProfile(db, childIdOf(context), parentId);
  if (!result.ok) return childErrorResponse(result.code);

  return jsonResponse({ ok: true, child: publicChild(result.value) });
};
