import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendHtml, sendJson } from "./http.js";

const swaggerUser = process.env.SWAGGER_USER ?? "admin";
const swaggerPassword = process.env.SWAGGER_PASSWORD ?? "admin123";

export function isSwaggerAuthorized(req: IncomingMessage): boolean {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return false;
  }

  const login = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return safeEqual(login, swaggerUser) && safeEqual(password, swaggerPassword);
}

export function sendSwaggerUnauthorized(res: ServerResponse): void {
  res.writeHead(401, {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Content-Type": "application/json; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="Questionnaire API docs"',
  });
  res.end(JSON.stringify({ error: "Нужен доступ к документации API." }));
}

export function sendSwaggerUi(res: ServerResponse): void {
  sendHtml(res, 200, swaggerHtml);
}

export function sendOpenApiDocument(res: ServerResponse): void {
  sendJson(res, 200, openApiDocument);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

const swaggerHtml = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Документация API опросника</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f3faf8; }
      .topbar { display: none; }
      .swagger-ui .info .title { color: #06231f; }
      .swagger-ui .scheme-container { border-radius: 16px; box-shadow: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "API опросника первой линии",
    version: "0.1.0",
    description: "Backend для загрузки сценариев из 1С, управления пользователями и хранения прохождений опросника.",
  },
  servers: [
    {
      url: "http://localhost:4100",
      description: "Локальный сервер разработки",
    },
  ],
  tags: [
    { name: "Вход" },
    { name: "Пользователи" },
    { name: "Опросники" },
    { name: "Прохождения" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Нужно войти в систему." },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["login", "password", "fullName"],
        properties: {
          login: { type: "string", example: "ivanov" },
          password: { type: "string", minLength: 6, example: "strong-password" },
          fullName: { type: "string", example: "Иванов Иван" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["login", "password"],
        properties: {
          login: { type: "string", example: "admin" },
          password: { type: "string", example: "admin123" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "usr_123" },
          login: { type: "string", example: "admin" },
          fullName: { type: "string", example: "Администратор" },
          email: { type: "string", example: "operator@k-service44.ru" },
          phone: { type: "string", example: "+7 900 000-00-00" },
          position: { type: "string", example: "Оператор первой линии" },
          role: { type: "string", enum: ["user", "operator", "admin"] },
          active: { type: "boolean" },
          preferences: { $ref: "#/components/schemas/UserPreferences" },
        },
      },
      UserPreferences: {
        type: "object",
        properties: {
          theme: { type: "string", enum: ["light", "dark"] },
          textSize: { type: "string", enum: ["normal", "large", "xlarge"] },
          readingMode: { type: "string", enum: ["normal", "high-contrast"] },
          profileIcon: { type: "string", enum: ["person", "headset", "shield", "star", "check"] },
          profileColor: { type: "string", enum: ["teal", "mint", "blue", "amber", "rose"] },
          avatarImage: {
            type: "string",
            description: "Картинка профиля в формате data URL или пустая строка.",
          },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          fullName: { type: "string", example: "Иванов Иван" },
          email: { type: "string", example: "operator@k-service44.ru" },
          phone: { type: "string", example: "+7 900 000-00-00" },
          position: { type: "string", example: "Оператор первой линии" },
          preferences: { $ref: "#/components/schemas/UserPreferences" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          token: { type: "string" },
        },
      },
      UpdateUserRequest: {
        type: "object",
        required: ["role"],
        properties: {
          role: { type: "string", enum: ["user", "operator", "admin"] },
          active: { type: "boolean" },
        },
      },
      PublishQuestionnaireRequest: {
        type: "object",
        properties: {
          versionId: { type: "string", example: "qv_123" },
        },
      },
      CreateRunRequest: {
        type: "object",
        required: ["questionnaireId"],
        properties: {
          questionnaireId: { type: "string", example: "kkt-call-checklist" },
        },
      },
      RunPayloadRequest: {
        type: "object",
        properties: {
          currentQuestionId: { type: ["string", "null"] },
          answers: {
            type: "object",
            additionalProperties: {
              oneOf: [
                { type: "string" },
                { type: "boolean" },
                { type: "number" },
                { type: "array", items: { type: "string" } },
                { type: "null" },
              ],
            },
          },
          route: { type: "array", items: { type: "string" } },
          messages: { type: "array", items: { type: "string" } },
          verdicts: { type: "array", items: { type: "string" } },
          summaryText: { type: "string" },
        },
      },
      QuestionnaireRun: {
        type: "object",
        properties: {
          id: { type: "string" },
          questionnaireId: { type: "string" },
          questionnaireVersionId: { type: "string" },
          operatorId: { type: "string" },
          status: { type: "string", enum: ["draft", "finished"] },
          currentQuestionId: { type: ["string", "null"] },
          answers: { type: "object" },
          route: { type: "array", items: { type: "string" } },
          messages: { type: "array", items: { type: "string" } },
          verdicts: { type: "array", items: { type: "string" } },
          summaryText: { type: "string" },
          startedAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          finishedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Вход"],
        summary: "Создать пользователя без прав",
        requestBody: jsonBody("#/components/schemas/RegisterRequest"),
        responses: {
          201: response("Пользователь создан", { user: { $ref: "#/components/schemas/User" } }),
          409: errorResponse("Логин уже занят"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Вход"],
        summary: "Войти и получить токен",
        requestBody: jsonBody("#/components/schemas/LoginRequest"),
        responses: {
          200: response("Вход выполнен", { $ref: "#/components/schemas/LoginResponse" }),
          401: errorResponse("Неверный логин или пароль"),
        },
      },
    },
    "/api/me": {
      get: {
        tags: ["Вход"],
        security: [{ bearerAuth: [] }],
        summary: "Получить текущего пользователя",
        responses: {
          200: response("Текущий пользователь", { user: { $ref: "#/components/schemas/User" } }),
          401: errorResponse("Нужно войти"),
        },
      },
    },
    "/api/me/profile": {
      patch: {
        tags: ["Вход"],
        security: [{ bearerAuth: [] }],
        summary: "Обновить профиль и настройки текущего пользователя",
        requestBody: jsonBody("#/components/schemas/UpdateProfileRequest"),
        responses: {
          200: response("Профиль обновлён", { user: { $ref: "#/components/schemas/User" } }),
          401: errorResponse("Нужно войти"),
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Пользователи"],
        security: [{ bearerAuth: [] }],
        summary: "Список пользователей, только администратор",
        responses: {
          200: response("Пользователи", {
            users: { type: "array", items: { $ref: "#/components/schemas/User" } },
          }),
          403: errorResponse("Недостаточно прав"),
        },
      },
    },
    "/api/users/{id}": {
      patch: {
        tags: ["Пользователи"],
        security: [{ bearerAuth: [] }],
        summary: "Изменить роль или активность пользователя",
        parameters: [pathParameter("id", "Идентификатор пользователя")],
        requestBody: jsonBody("#/components/schemas/UpdateUserRequest"),
        responses: {
          200: response("Пользователь обновлён", { user: { $ref: "#/components/schemas/User" } }),
          404: errorResponse("Пользователь не найден"),
        },
      },
    },
    "/api/questionnaires": {
      get: {
        tags: ["Опросники"],
        security: [{ bearerAuth: [] }],
        summary: "Список опубликованных опросников",
        responses: {
          200: response("Опросники", {
            questionnaires: { type: "array", items: { type: "object" } },
          }),
        },
      },
    },
    "/api/questionnaires/{id}": {
      get: {
        tags: ["Опросники"],
        security: [{ bearerAuth: [] }],
        summary: "Получить опубликованный опросник",
        parameters: [pathParameter("id", "Идентификатор опросника")],
        responses: {
          200: response("Опросник", { questionnaire: { type: "object" } }),
          404: errorResponse("Опросник не найден"),
        },
      },
    },
    "/api/admin/questionnaires/import": {
      post: {
        tags: ["Опросники"],
        security: [{ bearerAuth: [] }],
        summary: "Импортировать JSON из 1С, только администратор",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: {
          201: response("Импорт выполнен", { imported: { type: "array", items: { type: "object" } } }),
          400: errorResponse("Файл не прошёл проверку"),
        },
      },
    },
    "/api/admin/questionnaires/{id}/publish": {
      post: {
        tags: ["Опросники"],
        security: [{ bearerAuth: [] }],
        summary: "Опубликовать выбранную или последнюю версию опросника, только администратор",
        parameters: [pathParameter("id", "Идентификатор опросника")],
        requestBody: jsonBody("#/components/schemas/PublishQuestionnaireRequest"),
        responses: {
          200: response("Версия опубликована", {
            questionnaire: { type: "object" },
            version: { type: "object" },
          }),
          404: errorResponse("Опросник или версия не найдены"),
        },
      },
    },
    "/api/questionnaire-runs": {
      get: {
        tags: ["Прохождения"],
        security: [{ bearerAuth: [] }],
        summary: "Список прохождений",
        responses: {
          200: response("Прохождения", {
            runs: { type: "array", items: { $ref: "#/components/schemas/QuestionnaireRun" } },
          }),
        },
      },
      post: {
        tags: ["Прохождения"],
        security: [{ bearerAuth: [] }],
        summary: "Начать прохождение опросника",
        requestBody: jsonBody("#/components/schemas/CreateRunRequest"),
        responses: {
          201: response("Прохождение создано", { run: { $ref: "#/components/schemas/QuestionnaireRun" } }),
        },
      },
    },
    "/api/questionnaire-runs/{id}/draft": {
      patch: {
        tags: ["Прохождения"],
        security: [{ bearerAuth: [] }],
        summary: "Сохранить черновик прохождения",
        parameters: [pathParameter("id", "Идентификатор прохождения")],
        requestBody: jsonBody("#/components/schemas/RunPayloadRequest"),
        responses: {
          200: response("Черновик сохранён", { run: { $ref: "#/components/schemas/QuestionnaireRun" } }),
        },
      },
    },
    "/api/questionnaire-runs/{id}": {
      get: {
        tags: ["Прохождения"],
        security: [{ bearerAuth: [] }],
        summary: "Получить одно прохождение",
        parameters: [pathParameter("id", "Идентификатор прохождения")],
        responses: {
          200: response("Прохождение", { run: { $ref: "#/components/schemas/QuestionnaireRun" } }),
          404: errorResponse("Прохождение не найдено"),
        },
      },
    },
    "/api/questionnaire-runs/{id}/finish": {
      post: {
        tags: ["Прохождения"],
        security: [{ bearerAuth: [] }],
        summary: "Завершить прохождение",
        parameters: [pathParameter("id", "Идентификатор прохождения")],
        requestBody: jsonBody("#/components/schemas/RunPayloadRequest"),
        responses: {
          200: response("Прохождение завершено", { run: { $ref: "#/components/schemas/QuestionnaireRun" } }),
        },
      },
    },
  },
} as const;

function jsonBody(schemaRef: string) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: schemaRef },
      },
    },
  };
}

function response(description: string, schema: object) {
  const responseSchema = "$ref" in schema
    ? schema
    : {
      type: "object",
      properties: schema,
    };

  return {
    description,
    content: {
      "application/json": {
        schema: responseSchema,
      },
    },
  };
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  };
}

function pathParameter(name: string, description: string) {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" },
  };
}
