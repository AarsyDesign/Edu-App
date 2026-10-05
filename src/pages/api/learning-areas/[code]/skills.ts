/**
 * GET /api/learning-areas/:code/skills — Skill untuk satu learning area (VRD Phase 5).
 * Terlindungi middleware parent.
 * Query: ?age=<3-7> (opsional) — filter skill yang cocok usia anak.
 * Response: { skills: Skill[] }
 */
import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db/index.ts";
import { parentIdOf } from "../../../../lib/children/api.ts";
import { errorResponse } from "../../../../lib/auth/http.ts";
import { getLearningAreaByCode, listSkillsForArea, listSkillsForAge } from "../../../../lib/learning/areas-skills.ts";

export const GET: APIRoute = async (context) => {
  const parentId = parentIdOf(context);
  if (parentId instanceof Response) return parentId;

  const areaCode = context.params.code;
  if (!areaCode || typeof areaCode !== "string") {
    return errorResponse(400, "INVALID_AREA", "Kode learning area tidak valid.");
  }

  const db = await getDb();
  const area = await getLearningAreaByCode(db, areaCode);
  if (!area) {
    return errorResponse(404, "AREA_NOT_FOUND", "Learning area tidak ditemukan.");
  }

  const ageParam = context.url.searchParams.get("age");
  let skills;
  if (ageParam !== null) {
    const age = Number(ageParam);
    if (!Number.isInteger(age) || age < 3 || age > 7) {
      return errorResponse(400, "INVALID_AGE", "Usia harus bilangan bulat 3–7.");
    }
    skills = await listSkillsForAge(db, age);
    // Filter hanya skill area ini
    skills = skills.filter((s) => s.learningAreaCode === areaCode);
  } else {
    skills = await listSkillsForArea(db, area.areaId);
  }

  return new Response(JSON.stringify({ skills }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};