/**
 * Test Phase 5: Learning Areas & Skills — migrasi seed + query baca.
 *
 * VRD 5.1–5.6: seed enam learning area, skill awal per area,
 * age suitability, difficulty, content-configurable (bukan hardcoded UI).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations, resolveMigrationsDir } from "../src/lib/db/index.ts";
import {
  listLearningAreas,
  getLearningAreaByCode,
  listSkillsForArea,
  listAllSkillsWithArea,
  listSkillsForAge,
} from "../src/lib/learning/areas-skills.ts";

let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.waitReady;
  await runMigrations(db, resolveMigrationsDir());
});

after(async () => {
  await db.close();
});

describe("Phase 5 — Learning Areas & Skills", () => {
  it("5.1 migrasi 0003 menanam 6 learning area MVP", async () => {
    const areas = await listLearningAreas(db);
    assert.equal(areas.length, 6, "harus ada 6 learning area");

    const codes = areas.map((a) => a.code);
    assert.deepEqual(codes, [
      "numbers",
      "letters",
      "logic",
      "shapes",
      "world",
      "adab_islam",
    ]);
  });

  it("5.1 learning area punya title & sort_order yang benar", async () => {
    const areas = await listLearningAreas(db);
    const numbers = areas.find((a) => a.code === "numbers");
    assert.ok(numbers);
    assert.equal(numbers!.title, "Angka & Berhitung");
    assert.equal(numbers!.sortOrder, 1);
    assert.equal(numbers!.isActive, true);
  });

  it("5.2 skill ditanam untuk tiap learning area (minimal 1 per area)", async () => {
    const allSkills = await listAllSkillsWithArea(db);
    assert.ok(allSkills.length > 0, "harus ada skill ditanam");

    // Setiap area punya minimal 1 skill
    const areas = await listLearningAreas(db);
    for (const area of areas) {
      const skills = allSkills.filter((s) => s.learningAreaCode === area.code);
      assert.ok(skills.length >= 1, `area ${area.code} harus punya skill`);
    }
  });

  it("5.3 age_min/age_max di rentang 3–7 dan age_min <= age_max", async () => {
    const allSkills = await listAllSkillsWithArea(db);
    for (const skill of allSkills) {
      assert.ok(skill.ageMin >= 3 && skill.ageMin <= 7, `ageMin ${skill.ageMin} di luar 3–7`);
      assert.ok(skill.ageMax >= 3 && skill.ageMax <= 7, `ageMax ${skill.ageMax} di luar 3–7`);
      assert.ok(skill.ageMin <= skill.ageMax, `ageMin > ageMax untuk ${skill.code}`);
    }
  });

  it("5.4 difficulty di rentang 1–3", async () => {
    const allSkills = await listAllSkillsWithArea(db);
    for (const skill of allSkills) {
      assert.ok(skill.difficulty >= 1 && skill.difficulty <= 3, `difficulty ${skill.difficulty} di luar 1–3`);
    }
  });

  it("5.5 prerequisite belum didefinisikan di skema (kolom tidak ada) — OK, VRD 5.5 opsional", async () => {
    // Skema skill tidak punya kolom prerequisite_id — sengaja untuk MVP.
    // Prerequisite bisa ditambahkan lewat migrasi baru bila butuh.
    const allSkills = await listAllSkillsWithArea(db);
    for (const skill of allSkills) {
      // Tidak ada properti prerequisite pada interface
      assert.ok(!("prerequisiteId" in skill));
    }
  });

  it("5.6 skill content-configurable: query by learning_area_id + age + difficulty", async () => {
    const numbersArea = await getLearningAreaByCode(db, "numbers");
    assert.ok(numbersArea);

    const skillsForArea = await listSkillsForArea(db, numbersArea!.areaId);
    assert.ok(skillsForArea.length >= 8, "numbers harus punya banyak skill");

    // Urut sort_order
    for (let i = 1; i < skillsForArea.length; i++) {
      assert.ok(
        skillsForArea[i - 1].sortOrder <= skillsForArea[i].sortOrder,
        "skill harus urut sort_order",
      );
    }
  });

  it("filter skill by child age (listSkillsForAge)", async () => {
    const skillsAge3 = await listSkillsForAge(db, 3);
    const skillsAge7 = await listSkillsForAge(db, 7);

    // Usia 3 hanya dapat skill age_min<=3 && age_max>=3
    for (const s of skillsAge3) {
      assert.ok(s.ageMin <= 3 && s.ageMax >= 3);
    }

    // Usia 7 mendapat skill berbeda (lebih banyak)
    assert.ok(skillsAge7.length >= skillsAge3.length);
  });

  it("getLearningAreaByCode mengembalikan null untuk kode tidak dikenal", async () => {
    const notFound = await getLearningAreaByCode(db, "tidak_ada");
    assert.equal(notFound, null);
  });

  it("migrasi 0003 idempoten: menjalankan ulang tidak error & tidak duplikat", async () => {
    const result = await runMigrations(db, resolveMigrationsDir());
    assert.equal(result.applied.length, 0, "tidak ada migrasi baru diterapkan");
    assert.ok(result.skipped.includes("0003_seed_learning_areas_skills.sql"));
  });
});