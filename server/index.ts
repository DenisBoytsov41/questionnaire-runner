import { createServer } from "node:http";
import { z } from "zod";
import {
  isQuestionnaireBundle,
  questionnaireInputSchema,
  validateQuestionnaireContract,
} from "./lib/questionnaireContract.js";
import {
  convertTreePackageToQuestionnaireInput,
  questionnaireTreePackageSchema,
} from "./lib/questionnaireTreeFormat.js";
import { canAssignUserRole } from "./lib/access.js";
import type { QuestionnaireRun, UserPreferences, UserRole } from "./types.js";
import { signToken, toPublicUser, verifyPassword } from "./lib/crypto.js";
import {
  createContext,
  getPathParts,
  HttpError,
  readJsonBody,
  requireRole,
  requireUser,
  sendError,
  sendJson,
} from "./lib/http.js";
import {
  checkDatabase,
  changeUserPassword,
  closeDatabase,
  createRun,
  createUser,
  deleteQuestionnaire,
  deleteQuestionnaireVersion,
  deleteDraftRun,
  findUserByLogin,
  finishRun,
  getPublishedQuestionnaire,
  getRunForUser,
  importQuestionnaireVersions,
  listQuestionnairesForAdminPage,
  listPublishedQuestionnairesPage,
  listRunsForUserPage,
  listUsersPage,
  publishQuestionnaireVersion,
  StorageConflictError,
  StorageForbiddenError,
  updateRunDraft,
  updateUserAdmin,
  updateUserProfile,
} from "./lib/storage.js";
import {
  isSwaggerAuthorized,
  sendOpenApiDocument,
  sendSwaggerUi,
  sendSwaggerUnauthorized,
} from "./lib/swagger.js";
import { attachRequestLogger, logError, logInfo, logWarn } from "./lib/logger.js";

const port = Number(process.env.PORT ?? 4100);
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
const maxAvatarImagePayloadLength = 14_500_000;
const adminRoles: UserRole[] = ["admin", "superadmin"];
const operatorRoles: UserRole[] = ["operator", "admin", "superadmin"];

function readPaginationQuery(url: URL) {
  return {
    page: readPositiveIntegerParam(url, "page"),
    pageSize: readPositiveIntegerParam(url, "pageSize"),
    search: url.searchParams.get("search") ?? "",
  };
}

function readUserListQuery(url: URL) {
  const role = url.searchParams.get("role");
  const normalizedRole: UserRole | "all" =
    role === "user" || role === "operator" || role === "admin" || role === "superadmin"
      ? role
      : "all";

  return {
    ...readPaginationQuery(url),
    role: normalizedRole,
  };
}

function readRunListQuery(url: URL) {
  const status = url.searchParams.get("status");
  const normalizedStatus: QuestionnaireRun["status"] | "all" =
    status === "draft" || status === "finished" ? status : "all";

  return {
    ...readPaginationQuery(url),
    status: normalizedStatus,
  };
}

function readPositiveIntegerParam(url: URL, name: string): number | undefined {
  const value = url.searchParams.get(name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

const registerSchema = z.object({
  login: z.string().trim().min(3),
  password: z.string().min(6),
  fullName: z.string().trim().min(2),
});

const createAdminUserSchema = z.object({
  login: z.string().trim().min(3),
  password: z.string().min(6),
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(50).optional(),
  position: z.string().trim().max(120).optional(),
  role: z.enum(["user", "operator", "admin", "superadmin"]).default("operator"),
  active: z.boolean().default(true),
});

const loginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const updateUserRoleSchema = z.object({
  role: z.enum(["user", "operator", "admin", "superadmin"]),
  active: z.boolean().optional(),
});

const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).default("light"),
  textSize: z.enum(["normal", "large", "xlarge"]).default("normal"),
  readingMode: z.enum(["normal", "high-contrast"]).default("normal"),
  profileIcon: z.enum(["person", "headset", "shield", "star", "check"]).default("person"),
  profileColor: z.enum(["teal", "mint", "blue", "amber", "rose"]).default("teal"),
  avatarImage: z.string().max(maxAvatarImagePayloadLength).default(""),
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(50).optional(),
  position: z.string().trim().max(120).optional(),
  preferences: userPreferencesSchema.optional(),
});

const createRunSchema = z.object({
  questionnaireId: z.string().min(1),
});

const publishQuestionnaireSchema = z.object({
  versionId: z.string().min(1).optional(),
});

const runPayloadSchema = z.object({
  currentQuestionId: z.string().nullable().optional(),
  answers: z.record(z.string(), z.union([
    z.string(),
    z.array(z.string()),
    z.boolean(),
    z.number(),
    z.null(),
  ])).default({}),
  route: z.array(z.string()).default([]),
  messages: z.array(z.string()).default([]),
  verdicts: z.array(z.string()).default([]),
  summaryText: z.string().default(""),
});

const server = createServer(async (req, res) => {
  attachRequestLogger(req, res);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, null);
    return;
  }

  try {
    const context = await createContext(req, res, jwtSecret);
    const parts = getPathParts(context.url);

    if (req.method === "GET" && parts[0] === "api" && parts[1] === "health") {
      await checkDatabase();
      sendJson(res, 200, {
        status: "ok",
        service: "backend",
        database: "ok",
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    if (parts[0] === "api" && parts[1] === "docs") {
      if (!isSwaggerAuthorized(req)) {
        sendSwaggerUnauthorized(res);
        return;
      }

      if (req.method === "GET" && !parts[2]) {
        sendSwaggerUi(res);
        return;
      }

      if (req.method === "GET" && parts[2] === "openapi.json") {
        sendOpenApiDocument(res);
        return;
      }
    }

    if (parts[0] !== "api") {
      sendJson(res, 404, { error: "Маршрут не найден." });
      return;
    }

    if (req.method === "POST" && parts[1] === "auth" && parts[2] === "register") {
      const body = registerSchema.parse(await readJsonBody(req));
      const user = await createUser(body);
      sendJson(res, 201, { user });
      return;
    }

    if (req.method === "POST" && parts[1] === "auth" && parts[2] === "login") {
      const body = loginSchema.parse(await readJsonBody(req));
      const loginResult = await login(body.login, body.password);
      sendJson(res, 200, loginResult);
      return;
    }

    if (req.method === "GET" && parts[1] === "me") {
      sendJson(res, 200, { user: requireUser(context) });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "me" && parts[2] === "profile") {
      const currentUser = requireUser(context);
      const body = updateProfileSchema.parse(await readJsonBody(req));
      const user = await updateUserProfile({
        userId: currentUser.id,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        position: body.position,
        preferences: body.preferences as UserPreferences | undefined,
      });

      if (!user) {
        throw new HttpError(404, "Пользователь не найден.");
      }

      sendJson(res, 200, { user });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "me" && parts[2] === "password") {
      const currentUser = requireUser(context);
      const body = changePasswordSchema.parse(await readJsonBody(req));
      await changeUserPassword({
        userId: currentUser.id,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });

      sendJson(res, 200, { changed: true });
      return;
    }

    if (req.method === "GET" && parts[1] === "users") {
      requireRole(context, adminRoles);
      const page = await listUsersPage(readUserListQuery(context.url));
      sendJson(res, 200, { users: page.items, pagination: page.pagination, summary: page.summary });
      return;
    }

    if (req.method === "POST" && parts[1] === "admin" && parts[2] === "users") {
      const admin = requireRole(context, adminRoles);
      const body = createAdminUserSchema.parse(await readJsonBody(req));

      if (body.role === "superadmin") {
        throw new HttpError(403, "Создать второго главного администратора нельзя.");
      }

      if (!canAssignUserRole(admin.role, body.role)) {
        throw new HttpError(403, "Только главный администратор может создавать других администраторов.");
      }

      const user = await createUser(body);
      sendJson(res, 201, { user });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "users" && parts[2]) {
      const admin = requireRole(context, adminRoles);
      const body = updateUserRoleSchema.parse(await readJsonBody(req));

      const user = await updateUserAdmin({
        actorId: admin.id,
        actorRole: admin.role,
        userId: parts[2],
        role: body.role,
        active: body.active,
      });

      if (!user) {
        throw new HttpError(404, "Пользователь не найден.");
      }

      sendJson(res, 200, { user });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaires" && !parts[2]) {
      requireRole(context, operatorRoles);
      const page = await listPublishedQuestionnairesPage(readPaginationQuery(context.url));
      sendJson(res, 200, { questionnaires: page.items, pagination: page.pagination });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaires" && parts[2]) {
      requireRole(context, operatorRoles);
      const questionnaire = await getPublishedQuestionnaire(parts[2]);

      if (!questionnaire) {
        throw new HttpError(404, "Опросник не найден.");
      }

      sendJson(res, 200, { questionnaire });
      return;
    }

    if (req.method === "POST" && parts[1] === "admin" && parts[2] === "questionnaires" && parts[3] === "import") {
      const admin = requireRole(context, adminRoles);
      const body = await readJsonBody(req);
      const result = await importQuestionnaires(body, admin.id);
      sendJson(res, 201, result);
      return;
    }

    if (req.method === "GET" && parts[1] === "admin" && parts[2] === "questionnaires" && !parts[3]) {
      requireRole(context, adminRoles);
      const page = await listQuestionnairesForAdminPage(readPaginationQuery(context.url));
      sendJson(res, 200, { questionnaires: page.items, pagination: page.pagination, summary: page.summary });
      return;
    }

    if (
      req.method === "POST"
      && parts[1] === "admin"
      && parts[2] === "questionnaires"
      && parts[3]
      && parts[4] === "publish"
    ) {
      const admin = requireRole(context, adminRoles);
      const body = publishQuestionnaireSchema.parse(await readJsonBody(req));
      const result = await publishQuestionnaireVersion({
        questionnaireId: parts[3],
        versionId: body.versionId,
        adminId: admin.id,
      });

      if (!result) {
        throw new HttpError(404, "Опросник или версия не найдены.");
      }

      sendJson(res, 200, result);
      return;
    }

    if (
      req.method === "DELETE"
      && parts[1] === "admin"
      && parts[2] === "questionnaires"
      && parts[3]
      && parts[4] === "versions"
      && parts[5]
    ) {
      const admin = requireRole(context, adminRoles);
      const deleted = await deleteQuestionnaireVersion({
        questionnaireId: parts[3],
        versionId: parts[5],
        adminId: admin.id,
      });

      if (!deleted) {
        throw new HttpError(404, "Сценарий или версия не найдены.");
      }

      sendJson(res, 200, { deleted: true });
      return;
    }

    if (
      req.method === "DELETE"
      && parts[1] === "admin"
      && parts[2] === "questionnaires"
      && parts[3]
      && !parts[4]
    ) {
      const admin = requireRole(context, adminRoles);
      const deleted = await deleteQuestionnaire({
        questionnaireId: parts[3],
        adminId: admin.id,
      });

      if (!deleted) {
        throw new HttpError(404, "Сценарий не найден.");
      }

      sendJson(res, 200, { deleted: true });
      return;
    }

    if (req.method === "POST" && parts[1] === "questionnaire-runs" && !parts[2]) {
      const user = requireRole(context, operatorRoles);
      const body = createRunSchema.parse(await readJsonBody(req));
      const run = await createRun(body.questionnaireId, user.id);

      if (!run) {
        throw new HttpError(404, "Опросник не найден.");
      }

      sendJson(res, 201, { run });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "questionnaire-runs" && parts[2] && parts[3] === "draft") {
      const user = requireRole(context, operatorRoles);
      const body = runPayloadSchema.parse(await readJsonBody(req));
      const run = await updateRunDraft({
        runId: parts[2],
        userId: user.id,
        role: user.role,
        payload: body,
      });

      if (!run) {
        throw new HttpError(404, "Прохождение не найдено.");
      }

      sendJson(res, 200, { run });
      return;
    }

    if (req.method === "POST" && parts[1] === "questionnaire-runs" && parts[2] && parts[3] === "finish") {
      const user = requireRole(context, operatorRoles);
      const body = runPayloadSchema.parse(await readJsonBody(req));
      const run = await finishRun({
        runId: parts[2],
        userId: user.id,
        role: user.role,
        payload: body,
      });

      if (!run) {
        throw new HttpError(404, "Прохождение не найдено.");
      }

      sendJson(res, 200, { run });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaire-runs" && !parts[2]) {
      const user = requireRole(context, operatorRoles);
      const page = await listRunsForUserPage(user.id, user.role, readRunListQuery(context.url));
      sendJson(res, 200, { runs: page.items, pagination: page.pagination, summary: page.summary });
      return;
    }

    if (req.method === "DELETE" && parts[1] === "questionnaire-runs" && parts[2]) {
      const user = requireRole(context, operatorRoles);
      const deleted = await deleteDraftRun({
        runId: parts[2],
        userId: user.id,
        role: user.role,
      });

      if (!deleted) {
        throw new HttpError(404, "Прохождение не найдено.");
      }

      sendJson(res, 200, { deleted: true });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaire-runs" && parts[2]) {
      const user = requireRole(context, operatorRoles);
      const run = await getRunForUser(parts[2], user.id, user.role);

      if (!run) {
        throw new HttpError(404, "Прохождение не найдено.");
      }

      sendJson(res, 200, { run });
      return;
    }

    sendJson(res, 404, { error: "Маршрут не найден." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(res, 400, {
        error: "Данные запроса не прошли проверку.",
        details: formatSchemaIssues(error.issues),
      });
      return;
    }

    if (error instanceof StorageConflictError) {
      sendError(res, new HttpError(409, error.message));
      return;
    }

    if (error instanceof StorageForbiddenError) {
      sendError(res, new HttpError(403, error.message));
      return;
    }

    sendError(res, error);
  }
});

server.listen(port, () => {
  logInfo("server", "Backend запущен", { url: `http://localhost:${port}` });
  logInfo("server", "Учётная запись из ADMIN_LOGIN назначается главным администратором");
  logInfo("server", "Логин и пароль главного администратора задаются через ADMIN_LOGIN и ADMIN_PASSWORD");
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logInfo("server", "Получен сигнал остановки, закрываем backend", { signal });

  const forceExitTimer = setTimeout(() => {
    logWarn("server", "Backend не успел завершиться штатно, завершаем принудительно", { signal });
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((error) => {
    if (error) {
      logError("server", "Ошибка при остановке HTTP-сервера", { message: error.message });
    }

    closeDatabase()
      .then(() => {
        clearTimeout(forceExitTimer);
        logInfo("server", "Backend остановлен штатно", { signal });
        process.exit(error ? 1 : 0);
      })
      .catch((databaseError: Error) => {
        clearTimeout(forceExitTimer);
        logError("database", "Ошибка при закрытии соединений PostgreSQL", { message: databaseError.message });
        process.exit(1);
      });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function login(loginValue: string, password: string) {
  const user = await findUserByLogin(loginValue);

  if (!user || !user.active || !verifyPassword(password, user)) {
    throw new HttpError(401, "Неверный логин или пароль.");
  }

  const publicUser = toPublicUser(user);

  return {
    user: publicUser,
    token: signToken(publicUser, jwtSecret),
  };
}

async function importQuestionnaires(input: unknown, importedBy: string) {
  const parsed = parseSupportedQuestionnaireInput(input);

  if (!parsed.success) {
    throw new HttpError(400, parsed.errors.join(" "));
  }

  const questionnaires = isQuestionnaireBundle(parsed.data) ? parsed.data.questionnaires : [parsed.data];
  const errors = questionnaires.flatMap(validateQuestionnaireContract);

  if (errors.length > 0) {
    throw new HttpError(400, errors.join("; "));
  }

  return {
    imported: await importQuestionnaireVersions({ questionnaires, importedBy }),
  };
}

function parseSupportedQuestionnaireInput(input: unknown) {
  if (!isJsonObject(input)) {
    return {
      success: false as const,
      errors: ["В корне JSON должен находиться объект с описанием одного или нескольких сценариев."],
    };
  }

  if (input.format === "kservice_questionnaire_tree") {
    const treeParsed = questionnaireTreePackageSchema.safeParse(input);

    if (!treeParsed.success) {
      return {
        success: false as const,
        errors: formatSchemaIssues(treeParsed.error.issues),
      };
    }

    const converted = questionnaireInputSchema.safeParse(
      convertTreePackageToQuestionnaireInput(treeParsed.data),
    );

    if (!converted.success) {
      return {
        success: false as const,
        errors: formatSchemaIssues(converted.error.issues),
      };
    }

    return {
      success: true as const,
      data: converted.data,
    };
  }

  if (typeof input.schema === "string") {
    const legacyParsed = questionnaireInputSchema.safeParse(input);

    if (legacyParsed.success) {
      return {
        success: true as const,
        data: legacyParsed.data,
      };
    }

    return {
      success: false as const,
      errors: formatSchemaIssues(legacyParsed.error.issues),
    };
  }

  return {
    success: false as const,
    errors: [
      "Не удалось распознать формат выгрузки.",
      'Для новой структуры требуется "format": "kservice_questionnaire_tree", "version": 1 и массив "questionnaires".',
      'Для прежней структуры требуется поле "schema".',
    ],
  };
}

function formatSchemaIssues(
  issues: ReadonlyArray<{
    code: string;
    path: PropertyKey[];
    message: string;
    expected?: string;
    values?: unknown[];
  }>,
): string[] {
  return issues.slice(0, 10).map((issue) => {
    const path = formatIssuePath(issue.path);
    const location = path ? `Поле «${path}»` : "Структура JSON";

    if (issue.code === "invalid_type") {
      return `${location} отсутствует или имеет неверный тип${formatExpectedType(issue.expected)}.`;
    }

    if (issue.code === "invalid_value" && issue.values?.length) {
      return `${location} содержит недопустимое значение. Допустимо: ${issue.values
        .map((value) => JSON.stringify(value))
        .join(", ")}.`;
    }

    if (issue.code === "too_small") {
      return `${location} не должно быть пустым.`;
    }

    if (issue.code === "invalid_union") {
      return `${location} не соответствует поддерживаемой структуре сценария.`;
    }

    return `${location}: ${translateValidationMessage(issue.message)}.`;
  });
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part + 1}]`;
    }

    return result ? `${result}.${String(part)}` : String(part);
  }, "");
}

function formatExpectedType(expected: string | undefined): string {
  const labels: Record<string, string> = {
    array: "массив",
    boolean: "логическое значение",
    number: "число",
    object: "объект",
    string: "строка",
  };

  return expected ? ` (ожидается ${labels[expected] ?? expected})` : "";
}

function translateValidationMessage(message: string): string {
  if (message === "Invalid input") {
    return "указано некорректное значение";
  }

  if (message.startsWith("Invalid input: expected ")) {
    return "значение имеет неверный тип";
  }

  return message.replace(/\.$/, "");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
