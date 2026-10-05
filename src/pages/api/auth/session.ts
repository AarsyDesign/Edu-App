/**
 * Cek sesi aktif (GET /api/auth/session).
 * Dipakai halaman orang tua untuk memutuskan: tampilkan dasbor atau alihkan
 * ke login. Selalu dijawab tanpa cache karena berisi status sesi.
 */
import type { APIRoute } from "astro";
import { getParentById } from "../../../lib/auth/accounts.ts";
import {
  clearSessionCookie,
  jsonResponse,
  readSessionCookie,
} from "../../../lib/auth/http.ts";
import { resolveSession } from "../../../lib/auth/session.ts";
import { getDb } from "../../../lib/db/index.ts";

export const GET: APIRoute = async ({ cookies }) => {
  const token = readSessionCookie(cookies);
  const db = await getDb();

  if (token) {
    const session = await resolveSession(db, token);
    if (session) {
      const parent = await getParentById(db, session.parentId);
      if (parent) {
        return jsonResponse({
          authenticated: true,
          parentId: parent.parentId,
          displayName: parent.displayName,
          expiresAt: session.expiresAt.toISOString(),
        });
      }
    }
    // Cookie ada tetapi tidak sah (kedaluwarsa/dicabut) — bersihkan.
    clearSessionCookie(cookies);
  }

  return jsonResponse({ authenticated: false });
};
