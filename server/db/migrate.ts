import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Не задана переменная DATABASE_URL для подключения к базе данных.");
}

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");
const client = new Client({ connectionString: databaseUrl });

async function migrate(): Promise<void> {
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        id serial primary key,
        name text not null unique,
        applied_at timestamptz not null default now()
      );
    `);

    const appliedRows = await client.query<{ name: string }>("select name from schema_migrations");
    const applied = new Set(appliedRows.rows.map((row) => row.name));
    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    for (const migrationName of migrationNames) {
      if (applied.has(migrationName)) {
        continue;
      }

      const migrationPath = path.join(migrationsDirectory, migrationName);
      const sql = await readFile(migrationPath, "utf8");

      console.log(`Применяется миграция: ${migrationName}`);

      await client.query("begin");

      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [migrationName]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    console.log("Миграции базы данных применены.");
  } finally {
    await client.end();
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
