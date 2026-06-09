import { Pool, type PoolClient } from "pg";
import type {
  PublicUser,
  QuestionnaireRun,
  StoredQuestionnaire,
  StoredQuestionnaireVersion,
  StoredUser,
  UserPreferences,
  UserRole,
} from "../types.js";
import type { Questionnaire } from "./questionnaireContract.js";
import { createId, hashPassword, toPublicUser, verifyPassword } from "./crypto.js";
import { logWarn } from "./logger.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Не задана переменная DATABASE_URL. Backend работает только с PostgreSQL.");
}

const pool = new Pool({ connectionString: databaseUrl });
const maxAvatarImagePayloadLength = 14_500_000;

pool.on("error", (error: Error & { code?: string }) => {
  const code = error.code ?? "unknown";

  if (code === "57P01" || code === "57P02" || code === "57P03") {
    logWarn("database", "PostgreSQL закрыл простаивающее соединение", { code });
    return;
  }

  logWarn("database", "Ошибка простаивающего соединения PostgreSQL", {
    code,
    message: error.message,
  });
});

const defaultPreferences: UserPreferences = {
  theme: "light",
  textSize: "normal",
  readingMode: "normal",
  profileIcon: "person",
  profileColor: "teal",
  avatarImage: "",
};

const defaultPageSize = 10;
const maxPageSize = 100;

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole | "all";
  status?: QuestionnaireRun["status"] | "all";
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T, TSummary = undefined> {
  items: T[];
  pagination: PaginationMeta;
  summary?: TSummary;
}

export async function checkDatabase(): Promise<void> {
  await ensureInitialAdmin();
  await pool.query("select 1");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function getUserById(userId: string): Promise<StoredUser | null> {
  await ensureInitialAdmin();
  const result = await pool.query<UserRow>(userSelectSql("where id = $1"), [userId]);

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByLogin(login: string): Promise<StoredUser | null> {
  await ensureInitialAdmin();
  const result = await pool.query<UserRow>(userSelectSql("where lower(login) = lower($1)"), [login]);

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureInitialAdmin();
  const result = await pool.query<UserRow>(userSelectSql("order by created_at, login"));

  return result.rows.map(mapUser).map(toPublicUser);
}

export async function listUsersPage(input: PaginationInput = {}): Promise<PaginatedResult<PublicUser>> {
  await ensureInitialAdmin();
  const { page: requestedPage, pageSize, search } = sanitizePagination(input);
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (input.role && input.role !== "all") {
    params.push(input.role);
    conditions.push(`role = $${params.length}`);
  }

  addSearchCondition(conditions, params, ["login", "full_name", "email", "phone", "position"], search);

  const whereSql = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const totalItems = await countRows(`select count(*)::int as count from users ${whereSql}`, params);
  const pagination = buildPagination(totalItems, requestedPage, pageSize);
  const pageParams = [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const result = await pool.query<UserRow>(
    userSelectSql(` ${whereSql} order by created_at, login limit $${pageParams.length - 1} offset $${pageParams.length}`),
    pageParams,
  );

  return {
    items: result.rows.map(mapUser).map(toPublicUser),
    pagination,
  };
}

export async function createUser(input: {
  login: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  position?: string;
  role?: UserRole;
  active?: boolean;
}): Promise<PublicUser> {
  return inTransaction(async (client) => {
    await ensureInitialAdmin(client);

    const login = input.login.trim();
    const fullName = input.fullName.trim();
    const exists = await client.query<{ id: string }>(
      "select id from users where lower(login) = lower($1)",
      [login],
    );

    if (exists.rowCount) {
      throw new StorageConflictError("Пользователь с таким логином уже есть.");
    }

    const now = new Date().toISOString();
    const { hash, salt } = hashPassword(input.password);
    const user: StoredUser = {
      id: createId("usr"),
      login,
      fullName,
      email: input.email?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      position: input.position?.trim() ?? "",
      role: input.role ?? "user",
      active: input.active ?? true,
      preferences: defaultPreferences,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now,
    };

    await insertUser(client, user);
    await addAuditLog(client, user.id, "user.registered", "user", user.id, {
      login: user.login,
      role: user.role,
      active: user.active,
    });

    return toPublicUser(user);
  });
}

export async function updateUserAdmin(input: {
  userId: string;
  role: UserRole;
  active?: boolean;
}): Promise<PublicUser | null> {
  return inTransaction(async (client) => {
    const result = await client.query<UserRow>(
      `
        update users
        set role = $2,
            active = coalesce($3, active),
            updated_at = now()
        where id = $1
        returning ${userColumns}
      `,
      [input.userId, input.role, input.active],
    );

    const user = result.rows[0] ? mapUser(result.rows[0]) : null;

    if (user) {
      await addAuditLog(client, null, "user.admin_updated", "user", user.id, {
        role: user.role,
        active: user.active,
      });
    }

    return user ? toPublicUser(user) : null;
  });
}

export async function updateUserProfile(input: {
  userId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;
  preferences?: UserPreferences;
}): Promise<PublicUser | null> {
  return inTransaction(async (client) => {
    const current = await client.query<UserRow>(userSelectSql("where id = $1"), [input.userId]);
    const existing = current.rows[0] ? mapUser(current.rows[0]) : null;

    if (!existing) {
      return null;
    }

    const preferences = input.preferences ?? existing.preferences;
    const result = await client.query<UserRow>(
      `
        update users
        set full_name = $2,
            email = $3,
            phone = $4,
            position = $5,
            preferences_json = $6::jsonb,
            updated_at = now()
        where id = $1
        returning ${userColumns}
      `,
      [
        input.userId,
        input.fullName ?? existing.fullName,
        input.email ?? existing.email,
        input.phone ?? existing.phone,
        input.position ?? existing.position,
        JSON.stringify(preferences),
      ],
    );

    const user = result.rows[0] ? mapUser(result.rows[0]) : null;

    if (user) {
      await addAuditLog(client, user.id, "user.profile_updated", "user", user.id, {});
    }

    return user ? toPublicUser(user) : null;
  });
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return inTransaction(async (client) => {
    await ensureInitialAdmin(client);

    const current = await client.query<UserRow>(userSelectSql("where id = $1"), [input.userId]);
    const user = current.rows[0] ? mapUser(current.rows[0]) : null;

    if (!user || !user.active) {
      throw new StorageForbiddenError("Пользователь не найден или вход закрыт.");
    }

    if (!verifyPassword(input.currentPassword, user)) {
      throw new StorageForbiddenError("Текущий пароль указан неверно.");
    }

    if (input.currentPassword === input.newPassword) {
      throw new StorageConflictError("Новый пароль должен отличаться от текущего.");
    }

    const { hash, salt } = hashPassword(input.newPassword);

    await client.query(
      `
        update users
        set password_hash = $2,
            password_salt = $3,
            updated_at = now()
        where id = $1
      `,
      [input.userId, hash, salt],
    );
    await addAuditLog(client, user.id, "user.password_changed", "user", user.id, {});
  });
}

export async function importQuestionnaireVersions(input: {
  questionnaires: Questionnaire[];
  importedBy: string;
}): Promise<Array<{ questionnaireId: string; versionId: string; version: number; title: string }>> {
  return inTransaction(async (client) => {
    const imported: Array<{ questionnaireId: string; versionId: string; version: number; title: string }> = [];

    for (const questionnaire of input.questionnaires) {
      const previous = await client.query<{ next_version: string }>(
        `
          select coalesce(max(version), 0) + 1 as next_version
          from questionnaire_versions
          where questionnaire_id = $1
        `,
        [questionnaire.id],
      );
      const versionNumber = Number(previous.rows[0]?.next_version ?? 1);
      const versionId = createId("qv");
      const questionnaireExists = await client.query<{ id: string }>(
        "select id from questionnaires where id = $1",
        [questionnaire.id],
      );

      if (questionnaireExists.rowCount) {
        await client.query(
          "update questionnaires set title = $2, archived = $3, updated_at = now() where id = $1",
          [questionnaire.id, questionnaire.title, !questionnaire.active],
        );
      } else {
        await client.query(
          `
            insert into questionnaires (id, title, active_version_id, archived)
            values ($1, $2, null, $3)
          `,
          [questionnaire.id, questionnaire.title, !questionnaire.active],
        );
      }

      await client.query(
        `
          insert into questionnaire_versions (
            id, questionnaire_id, version, title, active, published, source_json, imported_by
          )
          values ($1, $2, $3, $4, $5, true, $6::jsonb, $7)
        `,
        [
          versionId,
          questionnaire.id,
          versionNumber,
          questionnaire.title,
          questionnaire.active,
          JSON.stringify(questionnaire),
          input.importedBy,
        ],
      );

      await client.query(
        "update questionnaires set active_version_id = $2, updated_at = now() where id = $1",
        [questionnaire.id, versionId],
      );

      imported.push({
        questionnaireId: questionnaire.id,
        versionId,
        version: versionNumber,
        title: questionnaire.title,
      });
    }

    await addAuditLog(client, input.importedBy, "questionnaires.imported", "questionnaire", null, {
      count: imported.length,
      questionnaires: imported.map((item) => item.questionnaireId),
    });

    return imported;
  });
}

export async function publishQuestionnaireVersion(input: {
  questionnaireId: string;
  versionId?: string;
  adminId: string;
}): Promise<{ questionnaire: StoredQuestionnaire; version: StoredQuestionnaireVersion } | null> {
  return inTransaction(async (client) => {
    const versionResult = input.versionId
      ? await client.query<QuestionnaireVersionRow>(
        versionSelectSql("where id = $1 and questionnaire_id = $2"),
        [input.versionId, input.questionnaireId],
      )
      : await client.query<QuestionnaireVersionRow>(
        versionSelectSql("where questionnaire_id = $1 order by version desc limit 1"),
        [input.questionnaireId],
      );
    const version = versionResult.rows[0] ? mapQuestionnaireVersion(versionResult.rows[0]) : null;

    if (!version) {
      return null;
    }

    await client.query(
      "update questionnaire_versions set published = false where questionnaire_id = $1",
      [input.questionnaireId],
    );
    const updatedVersion = await client.query<QuestionnaireVersionRow>(
      `
        update questionnaire_versions
        set published = true,
            active = true
        where id = $1
        returning ${versionColumns}
      `,
      [version.id],
    );
    const updatedQuestionnaire = await client.query<QuestionnaireRow>(
      `
        update questionnaires
        set active_version_id = $2,
            archived = false,
            title = $3,
            updated_at = now()
        where id = $1
        returning ${questionnaireColumns}
      `,
      [input.questionnaireId, version.id, version.title],
    );

    await addAuditLog(client, input.adminId, "questionnaire.published", "questionnaire", input.questionnaireId, {
      versionId: version.id,
      version: version.version,
    });

    const questionnaire = updatedQuestionnaire.rows[0] ? mapQuestionnaire(updatedQuestionnaire.rows[0]) : null;
    const publishedVersion = updatedVersion.rows[0] ? mapQuestionnaireVersion(updatedVersion.rows[0]) : null;

    return questionnaire && publishedVersion
      ? { questionnaire, version: publishedVersion }
      : null;
  });
}

export async function deleteQuestionnaireVersion(input: {
  questionnaireId: string;
  versionId: string;
  adminId: string;
}): Promise<boolean> {
  return inTransaction(async (client) => {
    const versionResult = await client.query<QuestionnaireVersionRow>(
      versionSelectSql("where id = $1 and questionnaire_id = $2"),
      [input.versionId, input.questionnaireId],
    );
    const version = versionResult.rows[0] ? mapQuestionnaireVersion(versionResult.rows[0]) : null;

    if (!version) {
      return false;
    }

    const runCount = await client.query<{ count: number }>(
      "select count(*)::int as count from questionnaire_runs where questionnaire_version_id = $1",
      [input.versionId],
    );

    if ((runCount.rows[0]?.count ?? 0) > 0) {
      throw new StorageConflictError(
        `Версию ${version.version} нельзя удалить: по ней уже есть черновики или завершённые прохождения.`,
      );
    }

    const versionCount = await client.query<{ count: number }>(
      "select count(*)::int as count from questionnaire_versions where questionnaire_id = $1",
      [input.questionnaireId],
    );

    if ((versionCount.rows[0]?.count ?? 0) <= 1) {
      throw new StorageConflictError(
        "Это единственная версия сценария. Для полного удаления используйте кнопку «Удалить сценарий».",
      );
    }

    await client.query(
      `
        update questionnaires
        set active_version_id = null,
            archived = true,
            updated_at = now()
        where id = $1 and active_version_id = $2
      `,
      [input.questionnaireId, input.versionId],
    );
    await client.query("delete from questionnaire_versions where id = $1", [input.versionId]);
    await addAuditLog(client, input.adminId, "questionnaire.version_deleted", "questionnaire", input.questionnaireId, {
      versionId: input.versionId,
      version: version.version,
    });

    return true;
  });
}

export async function deleteQuestionnaire(input: {
  questionnaireId: string;
  adminId: string;
}): Promise<boolean> {
  return inTransaction(async (client) => {
    const questionnaireResult = await client.query<QuestionnaireRow>(
      questionnaireSelectSql("where id = $1"),
      [input.questionnaireId],
    );
    const questionnaire = questionnaireResult.rows[0]
      ? mapQuestionnaire(questionnaireResult.rows[0])
      : null;

    if (!questionnaire) {
      return false;
    }

    const runCount = await client.query<{ count: number }>(
      "select count(*)::int as count from questionnaire_runs where questionnaire_id = $1",
      [input.questionnaireId],
    );

    if ((runCount.rows[0]?.count ?? 0) > 0) {
      throw new StorageConflictError(
        "Сценарий нельзя удалить: по нему уже есть черновики или завершённые прохождения.",
      );
    }

    await client.query(
      "update questionnaires set active_version_id = null where id = $1",
      [input.questionnaireId],
    );
    await client.query(
      "delete from questionnaire_versions where questionnaire_id = $1",
      [input.questionnaireId],
    );
    await client.query("delete from questionnaires where id = $1", [input.questionnaireId]);
    await addAuditLog(client, input.adminId, "questionnaire.deleted", "questionnaire", input.questionnaireId, {
      title: questionnaire.title,
    });

    return true;
  });
}

export async function listQuestionnairesForAdmin() {
  await ensureInitialAdmin();

  const questionnairesResult = await pool.query<QuestionnaireRow>(
    questionnaireSelectSql("order by updated_at desc, title"),
  );
  const versionsResult = await pool.query<QuestionnaireVersionRow>(
    versionSelectSql("order by questionnaire_id, version desc"),
  );
  const versionsByQuestionnaire = new Map<string, StoredQuestionnaireVersion[]>();

  for (const row of versionsResult.rows) {
    const version = mapQuestionnaireVersion(row);
    const versions = versionsByQuestionnaire.get(version.questionnaireId) ?? [];

    versions.push(version);
    versionsByQuestionnaire.set(version.questionnaireId, versions);
  }

  return questionnairesResult.rows.map((row) => {
    const questionnaire = mapQuestionnaire(row);
    const versions = versionsByQuestionnaire.get(questionnaire.id) ?? [];

    return {
      ...questionnaire,
      versions: versions.map((version) => ({
        id: version.id,
        questionnaireId: version.questionnaireId,
        version: version.version,
        title: version.title,
        active: version.active,
        published: version.published,
        importedBy: version.importedBy,
        importedAt: version.importedAt,
      })),
    };
  });
}

export async function listQuestionnairesForAdminPage(input: PaginationInput = {}) {
  await ensureInitialAdmin();
  const { page: requestedPage, pageSize, search } = sanitizePagination(input);
  const params: unknown[] = [];
  const conditions: string[] = [];

  addQuestionnaireSearchCondition(conditions, params, search);

  const whereSql = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const totalItems = await countRows(`select count(*)::int as count from questionnaires ${whereSql}`, params);
  const activeItems = await countRows(
    `select count(*)::int as count from questionnaires ${conditions.length ? `where ${conditions.join(" and ")} and archived = false` : "where archived = false"}`,
    params,
  );
  const totalVersions = await countRows(
    `
      select count(*)::int as count
      from questionnaire_versions
      join questionnaires on questionnaires.id = questionnaire_versions.questionnaire_id
      ${whereSql}
    `,
    params,
  );
  const pagination = buildPagination(totalItems, requestedPage, pageSize);
  const pageParams = [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const questionnairesResult = await pool.query<QuestionnaireRow>(
    questionnaireSelectSql(` ${whereSql} order by updated_at desc, title limit $${pageParams.length - 1} offset $${pageParams.length}`),
    pageParams,
  );
  const questionnaireIds = questionnairesResult.rows.map((row) => row.id);
  const versionsResult = questionnaireIds.length
    ? await pool.query<QuestionnaireVersionRow>(
      versionSelectSql("where questionnaire_id = any($1::text[]) order by questionnaire_id, version desc"),
      [questionnaireIds],
    )
    : { rows: [] as QuestionnaireVersionRow[] };
  const versionsByQuestionnaire = new Map<string, StoredQuestionnaireVersion[]>();

  for (const row of versionsResult.rows) {
    const version = mapQuestionnaireVersion(row);
    const versions = versionsByQuestionnaire.get(version.questionnaireId) ?? [];

    versions.push(version);
    versionsByQuestionnaire.set(version.questionnaireId, versions);
  }

  return {
    items: questionnairesResult.rows.map((row) => {
      const questionnaire = mapQuestionnaire(row);
      const versions = versionsByQuestionnaire.get(questionnaire.id) ?? [];

      return {
        ...questionnaire,
        versions: versions.map((version) => ({
          id: version.id,
          questionnaireId: version.questionnaireId,
          version: version.version,
          title: version.title,
          active: version.active,
          published: version.published,
          importedBy: version.importedBy,
          importedAt: version.importedAt,
        })),
      };
    }),
    pagination,
    summary: {
      totalQuestionnaires: totalItems,
      totalVersions,
      activeQuestionnaires: activeItems,
    },
  };
}

export async function listPublishedQuestionnaires() {
  await ensureInitialAdmin();
  const result = await pool.query<PublishedQuestionnaireRow>(`
    select
      q.id,
      q.title,
      q.active_version_id,
      v.version,
      v.imported_at
    from questionnaires q
    join questionnaire_versions v on v.id = q.active_version_id
    where q.archived = false and v.published = true
    order by q.title
  `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    activeVersionId: row.active_version_id,
    version: row.version,
    importedAt: toIso(row.imported_at),
  }));
}

export async function listPublishedQuestionnairesPage(input: PaginationInput = {}) {
  await ensureInitialAdmin();
  const { page: requestedPage, pageSize, search } = sanitizePagination(input);
  const params: unknown[] = [];
  const conditions = ["q.archived = false", "v.published = true"];

  addSearchCondition(conditions, params, ["q.id", "q.title"], search, ["cast(v.version as text)"]);

  const whereSql = `where ${conditions.join(" and ")}`;
  const totalItems = await countRows(
    `
      select count(*)::int as count
      from questionnaires q
      join questionnaire_versions v on v.id = q.active_version_id
      ${whereSql}
    `,
    params,
  );
  const pagination = buildPagination(totalItems, requestedPage, pageSize);
  const pageParams = [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const result = await pool.query<PublishedQuestionnaireRow>(
    `
      select
        q.id,
        q.title,
        q.active_version_id,
        v.version,
        v.imported_at
      from questionnaires q
      join questionnaire_versions v on v.id = q.active_version_id
      ${whereSql}
      order by q.title
      limit $${pageParams.length - 1} offset $${pageParams.length}
    `,
    pageParams,
  );

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      activeVersionId: row.active_version_id,
      version: row.version,
      importedAt: toIso(row.imported_at),
    })),
    pagination,
  };
}

export async function getPublishedQuestionnaire(questionnaireId: string) {
  await ensureInitialAdmin();
  const result = await pool.query<QuestionnaireWithVersionRow>(
    `
      select
        q.id,
        q.title,
        v.version,
        v.source_json
      from questionnaires q
      join questionnaire_versions v on v.id = q.active_version_id
      where q.id = $1 and q.archived = false and v.published = true
    `,
    [questionnaireId],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    version: row.version,
    source: row.source_json,
  };
}

export async function createRun(questionnaireId: string, operatorId: string): Promise<QuestionnaireRun | null> {
  return inTransaction(async (client) => {
    const questionnaire = await client.query<QuestionnaireRow>(
      questionnaireSelectSql("where id = $1 and archived = false"),
      [questionnaireId],
    );
    const item = questionnaire.rows[0] ? mapQuestionnaire(questionnaire.rows[0]) : null;

    if (!item?.activeVersionId) {
      return null;
    }

    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `${operatorId}:${questionnaireId}:${item.activeVersionId}`,
    ]);

    const existingDraft = await client.query<QuestionnaireRunRow>(
      runSelectSql(
        "where operator_id = $1 and questionnaire_id = $2 and questionnaire_version_id = $3 and status = 'draft' order by updated_at desc limit 1",
      ),
      [operatorId, questionnaireId, item.activeVersionId],
    );
    const existingRun = existingDraft.rows[0] ? mapQuestionnaireRun(existingDraft.rows[0]) : null;

    if (existingRun) {
      return existingRun;
    }

    const now = new Date().toISOString();
    const run: QuestionnaireRun = {
      id: createId("run"),
      questionnaireId,
      questionnaireVersionId: item.activeVersionId,
      operatorId,
      status: "draft",
      currentQuestionId: null,
      answers: {},
      route: [],
      messages: [],
      verdicts: [],
      summaryText: "",
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
    };

    await insertRun(client, run);
    await addAuditLog(client, operatorId, "run.created", "questionnaire_run", run.id, { questionnaireId });

    return run;
  });
}

export async function getRunForUser(runId: string, userId: string, role: UserRole): Promise<QuestionnaireRun | null> {
  await ensureInitialAdmin();
  const result = await pool.query<QuestionnaireRunRow>(
    runSelectSql("where id = $1"),
    [runId],
  );
  const run = result.rows[0] ? mapQuestionnaireRun(result.rows[0]) : null;

  if (!run) {
    return null;
  }

  if (role !== "admin" && run.operatorId !== userId) {
    throw new StorageForbiddenError("Нет доступа к этому прохождению.");
  }

  return run;
}

export async function listRunsForUser(userId: string, role: UserRole): Promise<QuestionnaireRun[]> {
  await ensureInitialAdmin();
  const result = role === "admin"
    ? await pool.query<QuestionnaireRunRow>(runSelectSql("order by started_at desc"))
    : await pool.query<QuestionnaireRunRow>(runSelectSql("where operator_id = $1 order by started_at desc"), [userId]);

  return result.rows.map(mapQuestionnaireRun);
}

export async function listRunsForUserPage(
  userId: string,
  role: UserRole,
  input: PaginationInput = {},
): Promise<PaginatedResult<QuestionnaireRun, {
  totalRuns: number;
  draftRuns: number;
  finishedRuns: number;
}>> {
  await ensureInitialAdmin();
  const { page: requestedPage, pageSize, search } = sanitizePagination(input);
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (role !== "admin") {
    params.push(userId);
    conditions.push(`operator_id = $${params.length}`);
  }

  if (input.status && input.status !== "all") {
    params.push(input.status);
    conditions.push(`status = $${params.length}`);
  }

  addSearchCondition(
    conditions,
    params,
    ["id", "questionnaire_id", "questionnaire_version_id", "coalesce(current_question_id, '')", "coalesce(summary_text, '')"],
    search,
  );

  const whereSql = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const totalItems = await countRows(`select count(*)::int as count from questionnaire_runs ${whereSql}`, params);
  const draftItems = await countRows(
    `select count(*)::int as count from questionnaire_runs ${conditions.length ? `where ${conditions.join(" and ")} and status = 'draft'` : "where status = 'draft'"}`,
    params,
  );
  const finishedItems = await countRows(
    `select count(*)::int as count from questionnaire_runs ${conditions.length ? `where ${conditions.join(" and ")} and status = 'finished'` : "where status = 'finished'"}`,
    params,
  );
  const pagination = buildPagination(totalItems, requestedPage, pageSize);
  const pageParams = [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize];
  const result = await pool.query<QuestionnaireRunRow>(
    runSelectSql(` ${whereSql} order by started_at desc limit $${pageParams.length - 1} offset $${pageParams.length}`),
    pageParams,
  );

  return {
    items: result.rows.map(mapQuestionnaireRun),
    pagination,
    summary: {
      totalRuns: totalItems,
      draftRuns: draftItems,
      finishedRuns: finishedItems,
    },
  };
}

export async function deleteDraftRun(input: {
  runId: string;
  userId: string;
  role: UserRole;
}): Promise<boolean> {
  return inTransaction(async (client) => {
    const currentResult = await client.query<QuestionnaireRunRow>(runSelectSql("where id = $1"), [input.runId]);
    const currentRun = currentResult.rows[0] ? mapQuestionnaireRun(currentResult.rows[0]) : null;

    if (!currentRun) {
      return false;
    }

    if (input.role !== "admin" && currentRun.operatorId !== input.userId) {
      throw new StorageForbiddenError("Нет доступа к этому прохождению.");
    }

    if (currentRun.status !== "draft") {
      throw new StorageConflictError("Удалить можно только черновик. Завершённое прохождение остаётся в истории.");
    }

    await client.query("delete from questionnaire_runs where id = $1", [input.runId]);
    await addAuditLog(
      client,
      input.userId,
      "run.draft_deleted",
      "questionnaire_run",
      input.runId,
      { questionnaireId: currentRun.questionnaireId },
    );

    return true;
  });
}

export async function updateRunDraft(input: {
  runId: string;
  userId: string;
  role: UserRole;
  payload: RunPayload;
}): Promise<QuestionnaireRun | null> {
  return updateRun(input, "draft");
}

export async function finishRun(input: {
  runId: string;
  userId: string;
  role: UserRole;
  payload: RunPayload;
}): Promise<QuestionnaireRun | null> {
  return updateRun(input, "finished");
}

async function updateRun(input: {
  runId: string;
  userId: string;
  role: UserRole;
  payload: RunPayload;
}, status: QuestionnaireRun["status"]): Promise<QuestionnaireRun | null> {
  return inTransaction(async (client) => {
    const currentResult = await client.query<QuestionnaireRunRow>(runSelectSql("where id = $1"), [input.runId]);
    const currentRun = currentResult.rows[0] ? mapQuestionnaireRun(currentResult.rows[0]) : null;

    if (!currentRun) {
      return null;
    }

    if (input.role !== "admin" && currentRun.operatorId !== input.userId) {
      throw new StorageForbiddenError("Нет доступа к этому прохождению.");
    }

    const result = await client.query<QuestionnaireRunRow>(
      `
        update questionnaire_runs
        set status = $2::questionnaire_run_status,
            current_question_id = $3,
            answers_json = $4::jsonb,
            route_json = $5::jsonb,
            messages_json = $6::jsonb,
            verdicts_json = $7::jsonb,
            summary_text = $8,
            updated_at = now(),
            finished_at = case when $2::questionnaire_run_status = 'finished' then now() else finished_at end
        where id = $1
        returning ${runColumns}
      `,
      [
        input.runId,
        status,
        input.payload.currentQuestionId ?? (status === "finished" ? null : currentRun.currentQuestionId),
        JSON.stringify(input.payload.answers),
        JSON.stringify(input.payload.route),
        JSON.stringify(input.payload.messages),
        JSON.stringify(input.payload.verdicts),
        input.payload.summaryText,
      ],
    );
    const run = result.rows[0] ? mapQuestionnaireRun(result.rows[0]) : null;

    if (run) {
      await addAuditLog(
        client,
        input.userId,
        status === "finished" ? "run.finished" : "run.draft_saved",
        "questionnaire_run",
        run.id,
        { questionnaireId: run.questionnaireId },
      );
    }

    return run;
  });
}

export interface RunPayload {
  currentQuestionId?: string | null;
  answers: QuestionnaireRun["answers"];
  route: string[];
  messages: string[];
  verdicts: string[];
  summaryText: string;
}

export class StorageConflictError extends Error {}
export class StorageForbiddenError extends Error {}

async function inTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await action(client);
    await client.query("commit");

    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
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
    const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "KService-Admin-2026!";
    const { hash, salt } = hashPassword(adminPassword);

    await insertUser(client, {
      id: createId("usr"),
      login: adminLogin,
      fullName: "Администратор",
      email: "",
      phone: "",
      position: "Администратор",
      role: "admin",
      active: true,
      preferences: defaultPreferences,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now,
    });
  } finally {
    if (!existingClient) {
      client.release();
    }
  }
}

async function insertUser(client: PoolClient, user: StoredUser): Promise<void> {
  await client.query(
    `
      insert into users (
        id,
        login,
        full_name,
        email,
        phone,
        position,
        role,
        active,
        preferences_json,
        password_hash,
        password_salt,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::timestamptz, $13::timestamptz
      )
    `,
    [
      user.id,
      user.login,
      user.fullName,
      user.email,
      user.phone,
      user.position,
      user.role,
      user.active,
      JSON.stringify(user.preferences),
      user.passwordHash,
      user.passwordSalt,
      user.createdAt,
      user.updatedAt,
    ],
  );
}

async function insertRun(client: PoolClient, run: QuestionnaireRun): Promise<void> {
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

function sanitizePagination(input: PaginationInput): Required<Pick<PaginationInput, "page" | "pageSize" | "search">> {
  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page ?? 1)) : 1;
  const rawPageSize = Number.isFinite(input.pageSize)
    ? Math.max(1, Math.floor(input.pageSize ?? defaultPageSize))
    : defaultPageSize;

  return {
    page,
    pageSize: Math.min(rawPageSize, maxPageSize),
    search: input.search?.trim().toLowerCase() ?? "",
  };
}

function buildPagination(totalItems: number, requestedPage: number, pageSize: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalItems,
    totalPages,
  };
}

async function countRows(sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query<CountRow>(sql, params);

  return Number(result.rows[0]?.count ?? 0);
}

function addSearchCondition(
  conditions: string[],
  params: unknown[],
  fields: string[],
  search: string,
  rawFields: string[] = [],
): void {
  if (!search) {
    return;
  }

  params.push(`%${search}%`);
  const placeholder = `$${params.length}`;
  const fieldConditions = [
    ...fields.map((field) => `lower(${field}) like ${placeholder}`),
    ...rawFields.map((field) => `lower(${field}) like ${placeholder}`),
  ];

  conditions.push(`(${fieldConditions.join(" or ")})`);
}

function addQuestionnaireSearchCondition(conditions: string[], params: unknown[], search: string): void {
  if (!search) {
    return;
  }

  params.push(`%${search}%`);
  const placeholder = `$${params.length}`;

  conditions.push(`(
    lower(id) like ${placeholder}
    or lower(title) like ${placeholder}
    or exists (
      select 1
      from questionnaire_versions
      where questionnaire_versions.questionnaire_id = questionnaires.id
        and cast(questionnaire_versions.version as text) like ${placeholder}
    )
  )`);
}

async function addAuditLog(
  client: PoolClient,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: object,
): Promise<void> {
  await client.query(
    `
      insert into audit_log (id, user_id, action, entity_type, entity_id, details_json)
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [createId("audit"), userId, action, entityType, entityId, JSON.stringify(details)],
  );
}

function userSelectSql(tail: string): string {
  return `select ${userColumns} from users ${tail}`;
}

function questionnaireSelectSql(tail: string): string {
  return `select ${questionnaireColumns} from questionnaires ${tail}`;
}

function versionSelectSql(tail: string): string {
  return `select ${versionColumns} from questionnaire_versions ${tail}`;
}

function runSelectSql(tail: string): string {
  return `select ${runColumns} from questionnaire_runs ${tail}`;
}

const userColumns = `
  id,
  login,
  full_name,
  email,
  phone,
  position,
  role,
  active,
  preferences_json,
  password_hash,
  password_salt,
  created_at,
  updated_at
`;

const questionnaireColumns = `
  id,
  title,
  active_version_id,
  archived,
  created_at,
  updated_at
`;

const versionColumns = `
  id,
  questionnaire_id,
  version,
  title,
  active,
  published,
  source_json,
  imported_by,
  imported_at
`;

const runColumns = `
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
`;

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    login: row.login,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    position: row.position,
    role: row.role,
    active: row.active,
    preferences: normalizePreferences(row.preferences_json),
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

function normalizePreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object") {
    return defaultPreferences;
  }

  const record = value as Partial<UserPreferences>;

  return {
    theme: record.theme === "dark" ? "dark" : "light",
    textSize: record.textSize === "large" || record.textSize === "xlarge" ? record.textSize : "normal",
    readingMode: record.readingMode === "high-contrast" ? "high-contrast" : "normal",
    profileIcon: normalizeProfileIcon(record.profileIcon),
    profileColor: normalizeProfileColor(record.profileColor),
    avatarImage: normalizeAvatarImage(record.avatarImage),
  };
}

function normalizeProfileIcon(value: unknown): UserPreferences["profileIcon"] {
  if (value === "headset" || value === "shield" || value === "star" || value === "check") {
    return value;
  }

  return "person";
}

function normalizeProfileColor(value: unknown): UserPreferences["profileColor"] {
  if (value === "mint" || value === "blue" || value === "amber" || value === "rose") {
    return value;
  }

  return "teal";
}

function normalizeAvatarImage(value: unknown): string {
  if (typeof value === "string" && value.startsWith("data:image/") && value.length <= maxAvatarImagePayloadLength) {
    return value;
  }

  return "";
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

interface UserRow {
  id: string;
  login: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  role: UserRole;
  active: boolean;
  preferences_json: unknown;
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
  source_json: Questionnaire;
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

interface PublishedQuestionnaireRow {
  id: string;
  title: string;
  active_version_id: string;
  version: number;
  imported_at: Date | string;
}

interface QuestionnaireWithVersionRow {
  id: string;
  title: string;
  version: number;
  source_json: Questionnaire;
}

interface CountRow {
  count: string | number;
}
