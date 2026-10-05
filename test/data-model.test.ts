/**
 * VRD Phase 2 — Data Model.
 * Membangun database BERSIH in-memory, menerapkan seluruh db/migrations/,
 * lalu memverifikasi entitas, FK/kepemilikan, enum, index, uniqueness,
 * trigger timestamp, provenance review, privasi anak, dan atomicitas migrasi
 * (item 2.1–2.15 + acceptance criteria Phase 2).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  resolveMigrationsDir,
  runMigrations,
} from "../src/lib/db/index.ts";

const root = new URL("../", import.meta.url).pathname;
const migrationsDir = resolveMigrationsDir();

const EXPECTED_TABLES = [
  "parent_account",
  "child_profile",
  "learning_area",
  "skill",
  "activity",
  "activity_option",
  "learning_session",
  "activity_attempt",
  "learning_progress",
  "content_review",
  "content_source",
  "app_setting",
];

let db: PGlite;

async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await db.query<T>(query);
  return res.rows;
}

async function expectFail(pattern: RegExp, query: string): Promise<void> {
  await assert.rejects(db.query(query), (err: Error) => {
    assert.match(err.message, pattern);
    return true;
  });
}

async function seedParent(): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO parent_account (id, email, display_name) VALUES ($1::uuid, $2, $3)",
    [id, `o${id.slice(0, 8)}@contoh.id`, "Orang Tua"],
  );
  return id;
}

before(async () => {
  db = new PGlite(); // database bersih, in-memory
  await runMigrations(db, migrationsDir);
});

after(async () => {
  await db.close();
});

test("2.14 migrasi dari database bersih: 12 tabel + tercatat di schema_migrations", async () => {
  const rows = await sql<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  const tables = new Set(rows.map((r) => r.table_name));
  for (const t of EXPECTED_TABLES) {
    assert.ok(tables.has(t), `tabel ${t} tidak dibuat`);
  }
  assert.equal(tables.size, EXPECTED_TABLES.length + 1, "tabel tak terduga muncul");

  const mig = await sql<{ id: string; checksum: string; applied_at: string }>(
    "SELECT id, checksum, applied_at FROM schema_migrations",
  );
  assert.equal(mig.length, 1);
  assert.equal(mig[0].id, "0001_init.sql");
  assert.match(mig[0].checksum, /^[0-9a-f]{64}$/);

  // Tabel hanya-tulis (append-only) sengaja tanpa updated_at: riwayat tidak
  // boleh diedit belakangan (provenance, SECURITY-PRIVACY).
  const APPEND_ONLY = new Set([
    "learning_session",
    "activity_attempt",
    "activity_option",
    "content_review",
    "content_source",
  ]);
  // 2.1 primary key + 2.3 timestamp di tiap entitas
  for (const t of EXPECTED_TABLES) {
    const pk = await sql<{ count: string }>(
      `SELECT count(*) AS count FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND table_name = '${t}' AND constraint_type = 'PRIMARY KEY'`,
    );
    assert.equal(Number(pk[0].count), 1, `${t} tanpa primary key`);
    // 2.3 timestamp: tiap entitas punya penanda waktu (created_at, atau
    // started_at/ended_at pada learning_session yang memang berbasis durasi).
    const ts = await sql<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${t}'
         AND column_name IN ('created_at', 'started_at')`,
    );
    assert.ok(ts.length >= 1, `${t} tanpa kolom timestamp`);
    const updatedAt = await sql<{ count: string }>(
      `SELECT count(*) AS count FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${t}' AND column_name = 'updated_at'`,
    );
    // Append-only: tanpa updated_at oleh desain (riwayat tak boleh diedit).
    if (!APPEND_ONLY.has(t)) {
      assert.equal(Number(updatedAt[0].count), 1, `${t} tanpa updated_at`);
    }
  }

  const sessCols = await sql<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'learning_session'
       AND column_name IN ('started_at', 'ended_at')`,
  );
  assert.equal(sessCols.length, 2, "learning_session wajib punya started_at + ended_at");
});

test("2.15 migrasi idempoten: dijalankan ulang tidak ada yang diterapkan lagi", async () => {
  const res = await runMigrations(db, migrationsDir);
  assert.deepEqual(res.applied, []);
  assert.deepEqual(res.skipped, ["0001_init.sql"]);
  const rows = await sql<{ count: string }>(
    "SELECT count(*) AS count FROM schema_migrations",
  );
  assert.equal(Number(rows[0].count), 1);
});

test("2.4 kepemilikan: profil anak harus punya orang tua (FK + cascade)", async () => {
  await expectFail(
    /foreign key constraint|violates/i,
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ('${randomUUID()}'::uuid, 'Anak', 4)`,
  );

  const parentId = await seedParent();
  const childId = randomUUID();
  await db.query(
    `INSERT INTO child_profile (id, parent_account_id, nickname, age)
     VALUES ($1::uuid, $2::uuid, 'Aini', 4)`,
    [childId, parentId],
  );

  const skillId = await seedSkill();
  const activityId = await seedActivity(skillId);
  await db.query(
    `INSERT INTO learning_session (id, child_id) VALUES ($1::uuid, $2::uuid)`,
    [randomUUID(), childId],
  );
  await db.query(
    `INSERT INTO activity_attempt (child_id, activity_id, answer, is_correct)
     VALUES ($1::uuid, $2::uuid, '{"choice":1}'::jsonb, true)`,
    [childId, activityId],
  );
  await db.query(
    `INSERT INTO learning_progress (child_id, skill_id) VALUES ($1::uuid, $2::uuid)`,
    [childId, skillId],
  );

  // Hapus orang tua -> seluruh data anak ikut hilang (retensi, VRD 4.10)
  await db.query("DELETE FROM parent_account WHERE id = $1::uuid", [parentId]);
  for (const t of ["child_profile", "learning_session", "activity_attempt", "learning_progress"]) {
    const rows = await sql<{ count: string }>(
      `SELECT count(*) AS count FROM ${t} WHERE ${t === "learning_session" || t === "activity_attempt" || t === "learning_progress" ? "child_id" : "id"} = '${childId}'`,
    );
    assert.equal(Number(rows[0].count), 0, `${t} tidak ter-cascade`);
  }
});

test("2.7/2.8 constraint usia, bahasa, kesukaran, dan enum aktivitas", async () => {
  const parentId = await seedParent();
  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ('${parentId}'::uuid, 'Anak', 8)`,
  );
  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ('${parentId}'::uuid, 'Anak', 2)`,
  );
  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO child_profile (parent_account_id, nickname, age, language)
     VALUES ('${parentId}'::uuid, 'Anak', 5, 'ID')`,
  );

  const areaId = await seedArea();
  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO skill (learning_area_id, code, title, age_min, age_max)
     VALUES ('${areaId}'::uuid, 'berhitung', 'Menghitung', 6, 4)`,
  );
  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO skill (learning_area_id, code, title, difficulty)
     VALUES ('${areaId}'::uuid, 'berhitung', 'Menghitung', 4)`,
  );

  const skillId = await seedSkill();
  await expectFail(
    /invalid input value for enum|violates/i,
    `INSERT INTO activity (skill_id, learning_area_id, prompt, interaction_type)
     VALUES ('${skillId}'::uuid, '${areaId}'::uuid, 'Pilih yang benar', 'FREE_CHAT')`,
  );
  await expectFail(
    /invalid input value for enum|violates/i,
    `INSERT INTO activity (skill_id, learning_area_id, prompt, interaction_type, review_status)
     VALUES ('${skillId}'::uuid, '${areaId}'::uuid, 'Pilih yang benar', 'TAP_ANSWER', 'APPROVED')`,
  );
  await expectFail(
    /foreign key constraint|violates/i,
    `INSERT INTO activity (skill_id, learning_area_id, prompt, interaction_type)
     VALUES ('${skillId}'::uuid, '${randomUUID()}'::uuid, 'Salah area', 'TAP_ANSWER')`,
  );
});

test("2.12 uniqueness: email, nickname aktif, kode area/skill, opsi, pengaturan", async () => {
  const p1 = await seedParent();
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO parent_account (email, display_name)
     VALUES ('  ${`o${p1.slice(0, 8)}`.toUpperCase()}@CONTOH.ID ', 'Duplikat')`,
  );

  await db.query(
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ($1::uuid, 'Aini', 5)`,
    [p1],
  );
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ('${p1}'::uuid, 'aini', 6)`,
  );
  // Setelah diarsip, nickname boleh dipakai lagi
  await db.query(
    `UPDATE child_profile SET archived_at = now() WHERE parent_account_id = $1::uuid`,
    [p1],
  );
  await db.query(
    `INSERT INTO child_profile (parent_account_id, nickname, age)
     VALUES ($1::uuid, 'Aini', 5)`,
    [p1],
  );

  const areaId = await seedArea();
  await db.query(
    `INSERT INTO learning_area (code, title) VALUES ('angka_berhitung', 'Angka & Berhitung')`,
  );
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO learning_area (code, title) VALUES ('angka_berhitung', 'Angka & Berhitung')`,
  );
  const skillId = await seedSkill(areaId);
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO skill (learning_area_id, code, title)
     VALUES ('${areaId}'::uuid, 'mengenal_angka', 'Mengenal Angka Duplikat')`,
  );

  const activityId = await seedActivity(skillId);
  await db.query(
    `INSERT INTO activity_option (activity_id, position, payload, is_correct)
     VALUES ($1::uuid, 5, '{"label":"3"}'::jsonb, false)`,
    [activityId],
  );
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO activity_option (activity_id, position, payload)
     VALUES ('${activityId}'::uuid, 5, '{"label":"4"}'::jsonb)`,
  );

  await db.query(
    `INSERT INTO app_setting (parent_account_id, key, value)
     VALUES ($1::uuid, 'audio.enabled', 'false'::jsonb)`,
    [p1],
  );
  await expectFail(
    /duplicate key|violates/i,
    `INSERT INTO app_setting (parent_account_id, key, value)
     VALUES ('${p1}'::uuid, 'audio.enabled', 'true'::jsonb)`,
  );
});

test("2.11 index wajib: parent_id, child_id, learning_area, rentang usia, status", async () => {
  const rows = await sql<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
  );
  const idx = new Set(rows.map((r) => r.indexname));
  const required = [
    "child_profile_parent_account_idx", // parent_id
    "child_profile_nickname_active_unique",
    "activity_attempt_child_idx", // child_id
    "learning_session_child_idx",
    "learning_progress_child_idx",
    "skill_learning_area_idx", // learning_area
    "activity_learning_area_idx",
    "skill_age_range_idx", // rentang usia
    "activity_age_range_idx",
    "activity_review_status_idx", // status konten
    "content_review_status_idx",
    "activity_origin_idx",
  ];
  for (const name of required) assert.ok(idx.has(name), `index ${name} hilang`);
});

test("2.3 updated_at dijaga trigger (bukan diisi aplikasi)", async () => {
  const id = await seedParent();
  await db.query(
    `UPDATE parent_account SET display_name = 'Diganti', updated_at = now() - interval '1 day' WHERE id = $1::uuid`,
    [id],
  );
  const rows = await sql<{ backdated: string; fresh: string }>(
    `SELECT (updated_at < now() - interval '1 hour')::text AS backdated,
            (updated_at > now() - interval '5 minutes')::text AS fresh
     FROM parent_account WHERE id = '${id}'`,
  );
  assert.equal(rows[0].backdated, "false", "updated_at tetap tua — trigger tidak jalan");
  assert.equal(rows[0].fresh, "true");
});

test("2.5 provinsi review: status aktivitas sinkron dengan jejak content_review", async () => {
  const skillId = await seedSkill();
  const areaId = await seedAreaIdOf(skillId);
  const activityId = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Sebutkan angka', 'TAP_ANSWER')`,
    [activityId, skillId, areaId],
  );

  await db.query(
    `INSERT INTO content_review (activity_id, from_status, to_status)
     VALUES ($1::uuid, 'DRAFT', 'HUMAN_REVIEW')`,
    [activityId],
  );
  let rows = await sql<{ review_status: string; reviewed_at: string | null }>(
    `SELECT review_status, reviewed_at FROM activity WHERE id = '${activityId}'`,
  );
  assert.equal(rows[0].review_status, "HUMAN_REVIEW");
  assert.ok(rows[0].reviewed_at, "reviewed_at tidak terisi");

  await expectFail(
    /check constraint|violates/i,
    `INSERT INTO content_review (activity_id, from_status, to_status)
     VALUES ('${activityId}'::uuid, 'DRAFT', 'DRAFT')`,
  );
  await expectFail(
    /invalid input value for enum|violates/i,
    `INSERT INTO content_review (activity_id, from_status, to_status)
     VALUES ('${activityId}'::uuid, 'DRAFT', 'LIVE_NOW')`,
  );
  const afterFail = await sql<{ review_status: string }>(
    `SELECT review_status FROM activity WHERE id = '${activityId}'`,
  );
  assert.equal(
    afterFail[0].review_status,
    "HUMAN_REVIEW",
    "gagal insert tidak boleh mengubah status",
  );
});

test("acceptance: anak tidak bisa di-query tanpa jalur kepemilikan & tanpa view publik", async () => {
  const views = await sql<{ count: string }>(
    "SELECT count(*) AS count FROM information_schema.views WHERE table_schema = 'public'",
  );
  assert.equal(
    Number(views[0].count),
    0,
    "view publik dilarang (SECURITY-PRIVACY: no public child profiles)",
  );

  const nullable = await sql<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'child_profile' AND column_name = 'parent_account_id'`,
  );
  assert.equal(nullable[0].is_nullable, "NO", "parent_account_id wajib NOT NULL");
});

test("acceptance: tidak ada kolom PII berlebih di child_profile", async () => {
  const cols = await sql<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'child_profile'`,
  );
  const names = cols.map((c) => c.column_name);
  const forbidden = [
    "full_name", "legal_name", "last_name", "birth_date", "birthdate", "dob",
    "address", "phone", "phone_number", "email", "location", "latitude",
    "longitude", "school", "photo",
  ];
  const hit = names.filter((n) => forbidden.includes(n));
  assert.deepEqual(hit, [], `kolom PII terlarang: ${hit.join(", ")}`);
  assert.deepEqual(
    names.sort(),
    [
      "age", "archived_at", "avatar_key", "created_at", "id",
      "language", "learning_goals", "nickname", "parent_account_id", "updated_at",
    ].sort(),
  );
});

test("riwayat jawaban anak tidak ikut terhapus saat konten dihapus (RESTRICT)", async () => {
  const skillId = await seedSkill();
  const areaId = await seedAreaIdOf(skillId);
  const parentId = await seedParent();
  const childId = randomUUID();
  await db.query(
    `INSERT INTO child_profile (id, parent_account_id, nickname, age)
     VALUES ($1::uuid, $2::uuid, 'Budi', 6)`,
    [childId, parentId],
  );
  const activityId = await seedActivity(skillId);
  await db.query(
    `INSERT INTO activity_attempt (child_id, activity_id, answer)
     VALUES ($1::uuid, $2::uuid, '{}'::jsonb)`,
    [childId, activityId],
  );
  await expectFail(
    /foreign key constraint|violates/i,
    `DELETE FROM activity WHERE id = '${activityId}'`,
  );
  await expectFail(
    /foreign key constraint|violates/i,
    `INSERT INTO activity_attempt (child_id, activity_id, answer, attempt_no)
     VALUES ('${randomUUID()}'::uuid, '${activityId}'::uuid, '{}'::jsonb, 1)`,
  );
  assert.ok(areaId);
});

test("2.15 migrasi gagal = transaksi batal, tidak ada potongan skema tertinggal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mig-"));
  try {
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql"));
    for (const f of files) {
      await writeFile(path.join(dir, f), await readFile(path.join(migrationsDir, f), "utf8"));
    }
    await writeFile(
      path.join(dir, "0002_sengaja_gagal.sql"),
      "CREATE TABLE tabel_ok (id int);\nCREATE TABLE_ini_syntax_error;\n",
    );

    const fresh = new PGlite();
    await fresh.waitReady;
    await assert.rejects(
      runMigrations(fresh, dir),
      /syntax error|0002_sengaja_gagal/i,
    );
    const tables = await fresh.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = tables.rows.map((r) => r.table_name);
    assert.ok(names.includes("parent_account"), "migrasi 0001 seharusnya tetap utuh");
    assert.ok(!names.includes("tabel_ok"), "0002 gagal tidak boleh meninggalkan tabel");
    const mig = await fresh.query<{ id: string }>("SELECT id FROM schema_migrations");
    assert.deepEqual(
      mig.rows.map((r) => r.id).sort(),
      ["0001_init.sql"],
      "migrasi gagal tidak boleh tercatat",
    );
    await fresh.close();

    // Checksum: file yang diedit setelah diterapkan harus ditolak
    await writeFile(
      path.join(dir, "0002_sengaja_gagal.sql"),
      "SELECT 1;\n",
    );
    const clean = new PGlite();
    await clean.waitReady;
    await runMigrations(clean, dir);
    await writeFile(path.join(dir, "0002_sengaja_gagal.sql"), "SELECT 2;\n");
    await assert.rejects(runMigrations(clean, dir), /checksum/i);
    await clean.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("folder migrasi sesuai repo (db/migrations)", () => {
  assert.equal(path.resolve(migrationsDir), path.resolve(root + "db/migrations"));
});

// ---------- helper seed ----------

async function seedArea(): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO learning_area (id, code, title)
     VALUES ($1::uuid, $2, 'Mata Pelajaran')`,
    [id, `area_${id.slice(0, 8)}`],
  );
  return id;
}

async function seedSkill(areaId?: string): Promise<string> {
  const area = areaId ?? (await seedArea());
  const id = randomUUID();
  await db.query(
    `INSERT INTO skill (id, learning_area_id, code, title, age_min, age_max, difficulty)
     VALUES ($1::uuid, $2::uuid, 'mengenal_angka', 'Mengenal Angka', 3, 7, 1)`,
    [id, area],
  );
  return id;
}

async function seedAreaIdOf(skillId: string): Promise<string> {
  const rows = await sql<{ learning_area_id: string }>(
    `SELECT learning_area_id FROM skill WHERE id = '${skillId}'`,
  );
  return rows[0].learning_area_id;
}

async function seedActivity(skillId: string): Promise<string> {
  const areaId = await seedAreaIdOf(skillId);
  const id = randomUUID();
  await db.query(
    `INSERT INTO activity (id, skill_id, learning_area_id, prompt, interaction_type, correct_answer)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Angka berapa?', 'TAP_ANSWER', '3'::jsonb)`,
    [id, skillId, areaId],
  );
  return id;
}
