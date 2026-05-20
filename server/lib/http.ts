import type { IncomingMessage, ServerResponse } from "node:http";
import type { PublicUser, UserRole } from "../types.js";
import { readStorage } from "./storage.js";
import { toPublicUser, verifyToken } from "./crypto.js";

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  user: PublicUser | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createContext(
  req: IncomingMessage,
  res: ServerResponse,
  jwtSecret: string,
): Promise<RequestContext> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const token = getBearerToken(req);
  const tokenPayload = token ? verifyToken(token, jwtSecret) : null;
  const storage = tokenPayload ? await readStorage() : null;
  const user = tokenPayload
    ? storage?.users.find((item) => item.id === tokenPayload.userId && item.active) ?? null
    : null;

  return {
    req,
    res,
    url,
    user: user ? toPublicUser(user) : null,
  };
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new HttpError(400, "Тело запроса должно быть корректным JSON.");
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

export function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(res, error.status, {
      error: error.message,
    });
    return;
  }

  console.error(error);
  sendJson(res, 500, {
    error: "Внутренняя ошибка сервера.",
  });
}

export function requireUser(context: RequestContext): PublicUser {
  if (!context.user) {
    throw new HttpError(401, "Нужно войти в систему.");
  }

  return context.user;
}

export function requireRole(context: RequestContext, roles: UserRole[]): PublicUser {
  const user = requireUser(context);

  if (!roles.includes(user.role)) {
    throw new HttpError(403, "Недостаточно прав для действия.");
  }

  return user;
}

export function getPathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function getBearerToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}
