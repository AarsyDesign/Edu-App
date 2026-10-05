/**
 * GET /api/learning-areas — Daftar learning area aktif (VRD Phase 5).
 * Terlindungi middleware parent (PROTECTED_PREFIXES /api/parent, /api/children).
 * Response: { areas: LearningArea[] }
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db/index.ts";
import { parentIdOf } from "../../../lib/children/api.ts";
import { errorResponse } from "../../../lib/auth/http.ts";
import { listLearningAreas } from "../../../lib/learning/areas-skills.ts";

export const GET: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const db = await getDb();
  const areas = await listLearningAreas(db);

  return new Response(JSON.stringify({ areas }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};