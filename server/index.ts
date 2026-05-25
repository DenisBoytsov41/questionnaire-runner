import { createServer } from "node:http";
import { z } from "zod";
import {
  isQuestionnaireBundle,
  questionnaireInputSchema,
  validateQuestionnaireContract,
} from "./lib/questionnaireContract.js";
import type { UserPreferences } from "./types.js";
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
  deleteDraftRun,
  findUserByLogin,
  finishRun,
  getPublishedQuestionnaire,
  getRunForUser,
  importQuestionnaireVersions,
  listQuestionnairesForAdmin,
  listPublishedQuestionnaires,
  listRunsForUser,
  listUsers,
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
  role: z.enum(["user", "operator", "admin"]).default("operator"),
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
  role: z.enum(["user", "operator", "admin"]),
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
      requireRole(context, ["admin"]);
      sendJson(res, 200, { users: await listUsers() });
      return;
    }

    if (req.method === "POST" && parts[1] === "admin" && parts[2] === "users") {
      requireRole(context, ["admin"]);
      const body = createAdminUserSchema.parse(await readJsonBody(req));
      const user = await createUser(body);
      sendJson(res, 201, { user });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "users" && parts[2]) {
      const admin = requireRole(context, ["admin"]);
      const body = updateUserRoleSchema.parse(await readJsonBody(req));

      if (parts[2] === admin.id && body.role !== admin.role) {
        throw new HttpError(409, "Нельзя менять роль своей учётной записи.");
      }

      const user = await updateUserAdmin({
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
      requireRole(context, ["operator", "admin"]);
      sendJson(res, 200, { questionnaires: await listPublishedQuestionnaires() });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaires" && parts[2]) {
      requireRole(context, ["operator", "admin"]);
      const questionnaire = await getPublishedQuestionnaire(parts[2]);

      if (!questionnaire) {
        throw new HttpError(404, "Опросник не найден.");
      }

      sendJson(res, 200, { questionnaire });
      return;
    }

    if (req.method === "POST" && parts[1] === "admin" && parts[2] === "questionnaires" && parts[3] === "import") {
      const admin = requireRole(context, ["admin"]);
      const body = await readJsonBody(req);
      const result = await importQuestionnaires(body, admin.id);
      sendJson(res, 201, result);
      return;
    }

    if (req.method === "GET" && parts[1] === "admin" && parts[2] === "questionnaires" && !parts[3]) {
      requireRole(context, ["admin"]);
      sendJson(res, 200, { questionnaires: await listQuestionnairesForAdmin() });
      return;
    }

    if (
      req.method === "POST"
      && parts[1] === "admin"
      && parts[2] === "questionnaires"
      && parts[3]
      && parts[4] === "publish"
    ) {
      const admin = requireRole(context, ["admin"]);
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

    if (req.method === "POST" && parts[1] === "questionnaire-runs" && !parts[2]) {
      const user = requireRole(context, ["operator", "admin"]);
      const body = createRunSchema.parse(await readJsonBody(req));
      const run = await createRun(body.questionnaireId, user.id);

      if (!run) {
        throw new HttpError(404, "Опросник не найден.");
      }

      sendJson(res, 201, { run });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "questionnaire-runs" && parts[2] && parts[3] === "draft") {
      const user = requireRole(context, ["operator", "admin"]);
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
      const user = requireRole(context, ["operator", "admin"]);
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
      const user = requireRole(context, ["operator", "admin"]);
      sendJson(res, 200, { runs: await listRunsForUser(user.id, user.role) });
      return;
    }

    if (req.method === "DELETE" && parts[1] === "questionnaire-runs" && parts[2]) {
      const user = requireRole(context, ["operator", "admin"]);
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
      const user = requireRole(context, ["operator", "admin"]);
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
        details: error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
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
  logInfo("server", "Первый администратор создаётся автоматически, если таблица пользователей пустая");
  logInfo("server", "Логин и пароль администратора можно задать через ADMIN_LOGIN и ADMIN_PASSWORD");
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
  const parsed = questionnaireInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
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
