import { createServer } from "node:http";
import { z } from "zod";
import {
  isQuestionnaireBundle,
  questionnaireInputSchema,
  type Questionnaire,
  validateQuestionnaireContract,
} from "./lib/questionnaireContract.js";
import type { AppStorage, QuestionnaireRun, StoredQuestionnaireVersion, UserRole } from "./types.js";
import { createId, hashPassword, signToken, toPublicUser, verifyPassword } from "./lib/crypto.js";
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
import { readStorage, updateStorage } from "./lib/storage.js";
import {
  isSwaggerAuthorized,
  sendOpenApiDocument,
  sendSwaggerUi,
  sendSwaggerUnauthorized,
} from "./lib/swagger.js";
import { attachRequestLogger, logInfo } from "./lib/logger.js";

const port = Number(process.env.PORT ?? 4100);
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";

const registerSchema = z.object({
  login: z.string().trim().min(3),
  password: z.string().min(6),
  fullName: z.string().trim().min(2),
});

const loginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

const updateUserRoleSchema = z.object({
  role: z.enum(["user", "operator", "admin"]),
  active: z.boolean().optional(),
});

const createRunSchema = z.object({
  questionnaireId: z.string().min(1),
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
      await readStorage();
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
      const user = await registerUser(body.login, body.password, body.fullName);
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

    if (req.method === "GET" && parts[1] === "users") {
      requireRole(context, ["admin"]);
      const storage = await readStorage();
      sendJson(res, 200, { users: storage.users.map(toPublicUser) });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "users" && parts[2]) {
      requireRole(context, ["admin"]);
      const body = updateUserRoleSchema.parse(await readJsonBody(req));
      const user = await updateUserRole(parts[2], body.role, body.active);
      sendJson(res, 200, { user });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaires" && !parts[2]) {
      requireRole(context, ["operator", "admin"]);
      const storage = await readStorage();
      sendJson(res, 200, { questionnaires: listQuestionnaires(storage) });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaires" && parts[2]) {
      requireRole(context, ["operator", "admin"]);
      const storage = await readStorage();
      sendJson(res, 200, { questionnaire: getPublishedQuestionnaire(storage, parts[2]) });
      return;
    }

    if (req.method === "POST" && parts[1] === "admin" && parts[2] === "questionnaires" && parts[3] === "import") {
      const admin = requireRole(context, ["admin"]);
      const body = await readJsonBody(req);
      const result = await importQuestionnaires(body, admin.id);
      sendJson(res, 201, result);
      return;
    }

    if (req.method === "POST" && parts[1] === "questionnaire-runs" && !parts[2]) {
      const user = requireRole(context, ["operator", "admin"]);
      const body = createRunSchema.parse(await readJsonBody(req));
      const run = await createRun(body.questionnaireId, user.id);
      sendJson(res, 201, { run });
      return;
    }

    if (req.method === "PATCH" && parts[1] === "questionnaire-runs" && parts[2] && parts[3] === "draft") {
      const user = requireRole(context, ["operator", "admin"]);
      const body = runPayloadSchema.parse(await readJsonBody(req));
      const run = await updateRunDraft(parts[2], user.id, user.role, body);
      sendJson(res, 200, { run });
      return;
    }

    if (req.method === "POST" && parts[1] === "questionnaire-runs" && parts[2] && parts[3] === "finish") {
      const user = requireRole(context, ["operator", "admin"]);
      const body = runPayloadSchema.parse(await readJsonBody(req));
      const run = await finishRun(parts[2], user.id, user.role, body);
      sendJson(res, 200, { run });
      return;
    }

    if (req.method === "GET" && parts[1] === "questionnaire-runs") {
      const user = requireRole(context, ["operator", "admin"]);
      const storage = await readStorage();
      const runs = user.role === "admin"
        ? storage.runs
        : storage.runs.filter((run) => run.operatorId === user.id);
      sendJson(res, 200, { runs });
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

    sendError(res, error);
  }
});

server.listen(port, () => {
  logInfo("server", "Backend запущен", { url: `http://localhost:${port}` });
  logInfo("server", "Первый администратор создаётся автоматически, если таблица пользователей пустая");
  logInfo("server", "Логин и пароль администратора можно задать через ADMIN_LOGIN и ADMIN_PASSWORD");
});

async function registerUser(login: string, password: string, fullName: string) {
  return updateStorage((storage) => {
    const normalizedLogin = login.toLowerCase();

    if (storage.users.some((user) => user.login.toLowerCase() === normalizedLogin)) {
      throw new HttpError(409, "Пользователь с таким логином уже есть.");
    }

    const now = new Date().toISOString();
    const { hash, salt } = hashPassword(password);
    const user = {
      id: createId("usr"),
      login,
      fullName,
      role: "user" as UserRole,
      active: true,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now,
    };

    storage.users.push(user);

    return toPublicUser(user);
  });
}

async function login(loginValue: string, password: string) {
  const storage = await readStorage();
  const user = storage.users.find((item) => item.login.toLowerCase() === loginValue.toLowerCase());

  if (!user || !user.active || !verifyPassword(password, user)) {
    throw new HttpError(401, "Неверный логин или пароль.");
  }

  const publicUser = toPublicUser(user);

  return {
    user: publicUser,
    token: signToken(publicUser, jwtSecret),
  };
}

async function updateUserRole(userId: string, role: UserRole, active: boolean | undefined) {
  return updateStorage((storage) => {
    const user = storage.users.find((item) => item.id === userId);

    if (!user) {
      throw new HttpError(404, "Пользователь не найден.");
    }

    user.role = role;
    user.active = active ?? user.active;
    user.updatedAt = new Date().toISOString();

    return toPublicUser(user);
  });
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

  return updateStorage((storage) => {
    const importedVersions = questionnaires.map((questionnaire) => (
      upsertQuestionnaire(storage, questionnaire, importedBy)
    ));

    return {
      imported: importedVersions.map((version) => ({
        questionnaireId: version.questionnaireId,
        versionId: version.id,
        version: version.version,
        title: version.title,
      })),
    };
  });
}

function upsertQuestionnaire(
  storage: AppStorage,
  questionnaire: Questionnaire,
  importedBy: string,
): StoredQuestionnaireVersion {
  const now = new Date().toISOString();
  const existingQuestionnaire = storage.questionnaires.find((item) => item.id === questionnaire.id);
  const previousVersions = storage.questionnaireVersions.filter((item) => item.questionnaireId === questionnaire.id);
  const versionNumber = previousVersions.length + 1;
  const version: StoredQuestionnaireVersion = {
    id: createId("qv"),
    questionnaireId: questionnaire.id,
    version: versionNumber,
    title: questionnaire.title,
    active: questionnaire.active,
    published: true,
    source: questionnaire,
    importedBy,
    importedAt: now,
  };

  storage.questionnaireVersions.push(version);

  if (existingQuestionnaire) {
    existingQuestionnaire.title = questionnaire.title;
    existingQuestionnaire.activeVersionId = version.id;
    existingQuestionnaire.archived = !questionnaire.active;
    existingQuestionnaire.updatedAt = now;
  } else {
    storage.questionnaires.push({
      id: questionnaire.id,
      title: questionnaire.title,
      activeVersionId: version.id,
      archived: !questionnaire.active,
      createdAt: now,
      updatedAt: now,
    });
  }

  return version;
}

function listQuestionnaires(storage: AppStorage) {
  return storage.questionnaires
    .filter((questionnaire) => !questionnaire.archived)
    .map((questionnaire) => {
      const version = storage.questionnaireVersions.find((item) => item.id === questionnaire.activeVersionId);

      return {
        id: questionnaire.id,
        title: questionnaire.title,
        version: version?.version ?? 0,
        importedAt: version?.importedAt ?? questionnaire.updatedAt,
      };
    });
}

function getPublishedQuestionnaire(storage: AppStorage, questionnaireId: string) {
  const questionnaire = storage.questionnaires.find((item) => item.id === questionnaireId && !item.archived);
  const version = questionnaire
    ? storage.questionnaireVersions.find((item) => item.id === questionnaire.activeVersionId)
    : null;

  if (!questionnaire || !version) {
    throw new HttpError(404, "Опросник не найден.");
  }

  return {
    id: questionnaire.id,
    title: questionnaire.title,
    version: version.version,
    source: version.source,
  };
}

async function createRun(questionnaireId: string, operatorId: string) {
  return updateStorage((storage) => {
    const questionnaire = storage.questionnaires.find((item) => item.id === questionnaireId && !item.archived);

    if (!questionnaire) {
      throw new HttpError(404, "Опросник не найден.");
    }

    const now = new Date().toISOString();
    const run: QuestionnaireRun = {
      id: createId("run"),
      questionnaireId,
      questionnaireVersionId: questionnaire.activeVersionId,
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

    storage.runs.push(run);

    return run;
  });
}

async function updateRunDraft(
  runId: string,
  userId: string,
  role: UserRole,
  payload: z.infer<typeof runPayloadSchema>,
) {
  return updateStorage((storage) => {
    const run = getEditableRun(storage, runId, userId, role);

    run.status = "draft";
    run.currentQuestionId = payload.currentQuestionId ?? run.currentQuestionId;
    run.answers = payload.answers;
    run.route = payload.route;
    run.messages = payload.messages;
    run.verdicts = payload.verdicts;
    run.summaryText = payload.summaryText;
    run.updatedAt = new Date().toISOString();

    return run;
  });
}

async function finishRun(
  runId: string,
  userId: string,
  role: UserRole,
  payload: z.infer<typeof runPayloadSchema>,
) {
  return updateStorage((storage) => {
    const run = getEditableRun(storage, runId, userId, role);
    const now = new Date().toISOString();

    run.status = "finished";
    run.currentQuestionId = payload.currentQuestionId ?? null;
    run.answers = payload.answers;
    run.route = payload.route;
    run.messages = payload.messages;
    run.verdicts = payload.verdicts;
    run.summaryText = payload.summaryText;
    run.updatedAt = now;
    run.finishedAt = now;

    return run;
  });
}

function getEditableRun(storage: AppStorage, runId: string, userId: string, role: UserRole): QuestionnaireRun {
  const run = storage.runs.find((item) => item.id === runId);

  if (!run) {
    throw new HttpError(404, "Прохождение не найдено.");
  }

  if (role !== "admin" && run.operatorId !== userId) {
    throw new HttpError(403, "Нет доступа к этому прохождению.");
  }

  return run;
}
