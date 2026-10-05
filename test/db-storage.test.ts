/**
 * Lapisan database pada disk (bukan in-memory).
 *
 * Menangkap dua hal yang hanya muncul di mesin bersih:
 * 1. folder induk database dibuat sendiri (PGlite/nodefs tidak membuatnya),
 * 2. seluruh db/migrations diterapkan dari nol beserta checksum-nya.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Folder induk yang belum ada — sengaja dibuat sedemikian rupa lewat mkdtemp
// lalu memakai sub-folder yang belum pernah dibuat.
const root = await mkdtemp(path.join(tmpdir(), "edu-db-"));
const dir = path.join(root, "belum", "ada", "pglite");
process.env.PGLITE_DIR = dir;
delete process.env.PGLITE_MODE;

const { getDb, closeDb } = await import("../src/lib/db/index.ts");

after(async () => {
  await closeDb();
  await rm(root, { recursive: true, force: true });
});

test("getDb membuat folder database sendiri & menerapkan migrasi dari nol", async () => {
  const db = await getDb();
  const res = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM schema_migrations",
  );
  const applied = Number(res.rows[0].count);
  assert.ok(applied >= 2, `migrasi belum diterapkan (count=${applied})`);

  // Bisa menulis & membaca data (bukti database benar-benar berfungsi).
  await db.query(
    `INSERT INTO parent_account (email, display_name, password_hash)
     VALUES ('disk@contoh.id', 'Disk', 'scrypt$16384$8$1$c2FsdA==$aGFzaA==')`,
  );
  const rows = await db.query<{ email: string }>(
    "SELECT email FROM parent_account WHERE email = 'disk@contoh.id'",
  );
  assert.equal(rows.rows.length, 1);
  assert.ok(
    rows.rows[0].email === "disk@contoh.id",
    "data tidak tertulis/terbaca dengan benar",
  );
});
