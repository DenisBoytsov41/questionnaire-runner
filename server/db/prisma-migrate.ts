import { spawn } from "node:child_process";
import "dotenv/config";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL
  ?? `postgresql://${process.env.POSTGRES_USER ?? "questionnaire"}:${process.env.POSTGRES_PASSWORD ?? "questionnaire_password"}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "questionnaire_runner"}`;
const baselineMigrationName = "00000000000000_baseline";

async function main(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const hasUsersTable = await tableExists(client, "users");
    const hasPrismaMigrations = await tableExists(client, "_prisma_migrations");

    if (hasUsersTable && !hasPrismaMigrations) {
      await assertCurrentSchemaCanBeBaselined(client);
      console.log("Найдена существующая схема БД. Помечаем базовую Prisma-миграцию как применённую.");
      await runPrisma(["migrate", "resolve", "--applied", baselineMigrationName]);
    }
  } finally {
    await client.end();
  }

  console.log("Применяем Prisma-миграции.");
  await runPrisma(["migrate", "deploy"]);
  console.log("Prisma-миграции применены.");
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      )
    `,
    [tableName],
  );

  return result.rows[0]?.exists ?? false;
}

async function assertCurrentSchemaCanBeBaselined(client: Client): Promise<void> {
  const requiredUserColumns = ["email", "phone", "position", "preferences_json"];
  const result = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
    `,
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  const missingColumns = requiredUserColumns.filter((column) => !columns.has(column));

  if (missingColumns.length > 0) {
    throw new Error(
      `Существующая БД не готова к Prisma baseline. Не хватает колонок users: ${missingColumns.join(", ")}.`,
    );
  }
}

async function runPrisma(args: string[]): Promise<void> {
  const command = process.execPath;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, ["node_modules/prisma/build/index.js", ...args, "--schema", "prisma/schema.prisma"], {
      env: process.env,
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Команда prisma ${args.join(" ")} завершилась с кодом ${code ?? "unknown"}.`));
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
