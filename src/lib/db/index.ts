/**
 * Lapisan database tunggal (PRD §19: single deployable, managed PostgreSQL).
 *
 * Kini memakai PGlite (PostgreSQL embedded, WASM) karena mesin lokal tidak punya
 * server PostgreSQL. Untuk pindah ke managed PostgreSQL cukup ganti isi modul ini:
 * seluruh kode lain hanya mengenal `getDb()` dan `runMigrations()`.
 *
 * Migrasi: file SQL di db/migrations/, urut nama, forward-only, satu file =
 * satu transaksi, dicatat di `schema_migrations` lengkap dengan checksum SHA-256.
 */
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Db = PGlite;

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          text PRIMARY KEY,
  checksum    text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);`;

/** Cari folder migrasi: env dulu, lalu naik dari cwd, lalu naik dari lokasi modul. */
export function resolveMigrationsDir(): string {
  const fromEnv = process.env.MIGRATIONS_DIR;
  if (fromEnv) return fromEnv;

  const roots = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];
  for (const root of roots) {
    let dir = root;
    for (let i = 0; i < 8; i += 1) {
      const candidate = path.join(dir, "db", "migrations");
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(
    "Folder db/migrations tidak ditemukan. Set env MIGRATIONS_DIR ke lokasinya.",
  );
}

async function listMigrationFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Terapkan semua migrasi yang belum masuk. Aman dipanggil berulang (idempoten).
 * Migrasi yang belum pernah diterapkan dijalankan dalam transaksi sendiri:
 * gagal = tidak ada jejak sama sekali (VRD 2.15).
 */
export async function runMigrations(
  db: Db,
  dir: string = resolveMigrationsDir(),
): Promise<MigrationResult> {
  await db.exec(MIGRATIONS_TABLE_SQL);

  const applied = new Map<string, string>();
  const rows = await db.query<{ id: string; checksum: string }>(
    "SELECT id, checksum FROM schema_migrations",
  );
  for (const row of rows.rows) applied.set(row.id, row.checksum);

  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of await listMigrationFiles(dir)) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const known = applied.get(file);

    if (known !== undefined) {
      if (known !== checksum) {
        throw new Error(
          `Migrasi ${file} berubah setelah diterapkan (checksum beda). ` +
            "Migrasi bersifat immutable — buat file baru 000N_xxx.sql, " +
            "atau hapus folder database lokal bila ini masih pengembangan.",
        );
      }
      result.skipped.push(file);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query(
        "INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
    });
    result.applied.push(file);
  }

  return result;
}

let singleton: Db | null = null;

/**
 * Koneksi aplikasi. Default: database persisten lokal `.data/pglite`
 * (ikut .gitignore) supaya data tidak hilang tiap restart; in-memory dipakai
 * bila `PGlite` env di-set ke `memory` (untuk smoke test).
 * TODO Phase 3+: ganti dengan managed PostgreSQL lewat DATABASE_URL.
 */
export async function getDb(): Promise<Db> {
  if (singleton) return singleton;

  const memory = process.env.PGLITE_MODE === "memory";
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const db = new PGlite(memory ? undefined : dir);
  await db.waitReady;
  await runMigrations(db);
  singleton = db;
  return db;
}

/** Tutup koneksi singleton (dipakai test dan graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (!singleton) return;
  await singleton.close();
  singleton = null;
}
