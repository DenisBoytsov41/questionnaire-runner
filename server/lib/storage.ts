import { Pool, type PoolClient } from "pg";
import type {
  AppStorage,
  QuestionnaireRun,
  StoredQuestionnaire,
  StoredQuestionnaireVersion,
  StoredUser,
  UserRole,
} from "../types.js";
import { createId, hashPassword } from "./crypto.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Не задана переменная DATABASE_URL. Backend теперь работает только с PostgreSQL.");
}

const pool = new Pool({ connectionString: databaseUrl });

export async function readStorage(): Promise<AppStorage> {
  await ensureInitialAdmin();

  const client = await pool.connect();

  try {
    return await readStorageFromClient(client);
  } finally {
    client.release();
  }
}

export async function updateStorage<T>(updater: (storage: AppStorage) => T): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureInitialAdmin(client);

    const storage = await readStorageFromClient(client);
    const result = updater(storage);

    await replaceStorage(client, storage);
    await client.query("commit");

    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function readStorageFromClient(client: PoolClient): Promise<AppStorage> {
  const users = await client.query<UserRow>(`
    select id, login, full_name, role, active, password_hash, password_salt, created_at, updated_at
    from users
    order by created_at, login
  `);

  const questionnaires = await client.query<QuestionnaireRow>(`
    select id, title, active_version_id, archived, created_at, updated_at
    from questionnaires
    order by created_at, title
  `);

  const versions = await client.query<QuestionnaireVersionRow>(`
    select id, questionnaire_id, version, title, active, published, source_json, imported_by, imported_at
    from questionnaire_versions
    order by imported_at, version
  `);

  const runs = await client.query<QuestionnaireRunRow>(`
    select
      id,
      questionnaire_id,
      questionnaire_version_id,
      operator_id,
      status,
      current_question_id,
      answers_json,
      route_json,
      messages_json,
      verdicts_json,
      summary_text,
      started_at,
      updated_at,
      finished_at
    from questionnaire_runs
    order by started_at, id
  `);

  return {
    users: users.rows.map(mapUser),
    questionnaires: questionnaires.rows.map(mapQuestionnaire),
    questionnaireVersions: versions.rows.map(mapQuestionnaireVersion),
    runs: runs.rows.map(mapQuestionnaireRun),
  };
}

async function replaceStorage(client: PoolClient, storage: AppStorage): Promise<void> {
  await client.query("delete from audit_log");
  await client.query("delete from questionnaire_runs");
  await client.query("delete from questionnaire_versions");
  await client.query("delete from questionnaires");
  await client.query("delete from users");

  for (const user of storage.users) {
    await client.query(
      `
        insert into users (
          id, login, full_name, role, active, password_hash, password_salt, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)
      `,
      [
        user.id,
        user.login,
        user.fullName,
        user.role,
        user.active,
        user.passwordHash,
        user.passwordSalt,
        user.createdAt,
        user.updatedAt,
      ],
    );
  }

  for (const questionnaire of storage.questionnaires) {
    await client.query(
      `
        insert into questionnaires (id, title, active_version_id, archived, created_at, updated_at)
        values ($1, $2, null, $3, $4::timestamptz, $5::timestamptz)
      `,
      [
        questionnaire.id,
        questionnaire.title,
        questionnaire.archived,
        questionnaire.createdAt,
        questionnaire.updatedAt,
      ],
    );
  }

  for (const version of storage.questionnaireVersions) {
    await client.query(
      `
        insert into questionnaire_versions (
          id,
          questionnaire_id,
          version,
          title,
          active,
          published,
          source_json,
          imported_by,
          imported_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::timestamptz)
      `,
      [
        version.id,
        version.questionnaireId,
        version.version,
        version.title,
        version.active,
        version.published,
        JSON.stringify(version.source),
        version.importedBy,
        version.importedAt,
      ],
    );
  }

  for (const questionnaire of storage.questionnaires) {
    await client.query(
      "update questionnaires set active_version_id = $1 where id = $2",
      [questionnaire.activeVersionId, questionnaire.id],
    );
  }

  for (const run of storage.runs) {
    await client.query(
      `
        insert into questionnaire_runs (
          id,
          questionnaire_id,
          questionnaire_version_id,
          operator_id,
          status,
          current_question_id,
          answers_json,
          route_json,
          messages_json,
          verdicts_json,
          summary_text,
          started_at,
          updated_at,
          finished_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11,
          $12::timestamptz, $13::timestamptz, $14::timestamptz
        )
      `,
      [
        run.id,
        run.questionnaireId,
        run.questionnaireVersionId,
        run.operatorId,
        run.status,
        run.currentQuestionId,
        JSON.stringify(run.answers),
        JSON.stringify(run.route),
        JSON.stringify(run.messages),
        JSON.stringify(run.verdicts),
        run.summaryText,
        run.startedAt,
        run.updatedAt,
        run.finishedAt,
      ],
    );
  }
}

async function ensureInitialAdmin(existingClient?: PoolClient): Promise<void> {
  const client = existingClient ?? await pool.connect();

  try {
    const usersCount = await client.query<{ count: string }>("select count(*) from users");

    if (Number(usersCount.rows[0]?.count ?? 0) > 0) {
      return;
    }

    const now = new Date().toISOString();
    const adminLogin = process.env.ADMIN_LOGIN?.trim() || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin123";
    const { hash, salt } = hashPassword(adminPassword);

    await client.query(
      `
        insert into users (
          id, login, full_name, role, active, password_hash, password_salt, created_at, updated_at
        )
        values ($1, $2, $3, 'admin', true, $4, $5, $6::timestamptz, $7::timestamptz)
      `,
      [
        createId("usr"),
        adminLogin,
        "Администратор",
        hash,
        salt,
        now,
        now,
      ],
    );
  } finally {
    if (!existingClient) {
      client.release();
    }
  }
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    login: row.login,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapQuestionnaire(row: QuestionnaireRow): StoredQuestionnaire {
  return {
    id: row.id,
    title: row.title,
    activeVersionId: row.active_version_id ?? "",
    archived: row.archived,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapQuestionnaireVersion(row: QuestionnaireVersionRow): StoredQuestionnaireVersion {
  return {
    id: row.id,
    questionnaireId: row.questionnaire_id,
    version: row.version,
    title: row.title,
    active: row.active,
    published: row.published,
    source: row.source_json,
    importedBy: row.imported_by ?? "",
    importedAt: toIso(row.imported_at),
  };
}

function mapQuestionnaireRun(row: QuestionnaireRunRow): QuestionnaireRun {
  return {
    id: row.id,
    questionnaireId: row.questionnaire_id,
    questionnaireVersionId: row.questionnaire_version_id,
    operatorId: row.operator_id ?? "",
    status: row.status,
    currentQuestionId: row.current_question_id,
    answers: row.answers_json,
    route: row.route_json,
    messages: row.messages_json,
    verdicts: row.verdicts_json,
    summaryText: row.summary_text,
    startedAt: toIso(row.started_at),
    updatedAt: toIso(row.updated_at),
    finishedAt: row.finished_at ? toIso(row.finished_at) : null,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

interface UserRow {
  id: string;
  login: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  password_hash: string;
  password_salt: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface QuestionnaireRow {
  id: string;
  title: string;
  active_version_id: string | null;
  archived: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface QuestionnaireVersionRow {
  id: string;
  questionnaire_id: string;
  version: number;
  title: string;
  active: boolean;
  published: boolean;
  source_json: StoredQuestionnaireVersion["source"];
  imported_by: string | null;
  imported_at: Date | string;
}

interface QuestionnaireRunRow {
  id: string;
  questionnaire_id: string;
  questionnaire_version_id: string;
  operator_id: string | null;
  status: QuestionnaireRun["status"];
  current_question_id: string | null;
  answers_json: QuestionnaireRun["answers"];
  route_json: string[];
  messages_json: string[];
  verdicts_json: string[];
  summary_text: string;
  started_at: Date | string;
  updated_at: Date | string;
  finished_at: Date | string | null;
}
