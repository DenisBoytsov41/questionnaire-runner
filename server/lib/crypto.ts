import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PublicUser, StoredUser, UserRole } from "../types.js";

const passwordKeyLength = 64;

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, passwordKeyLength).toString("hex");

  return {
    hash,
    salt,
  };
}

export function verifyPassword(password: string, user: StoredUser): boolean {
  const { hash } = hashPassword(password, user.passwordSalt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(user.passwordHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signToken(user: PublicUser, secret: string): string {
  const payload = toBase64Url(JSON.stringify({
    sub: user.id,
    login: user.login,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

export function verifyToken(token: string, secret: string): { userId: string; role: UserRole } | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      role?: UserRole;
    };

    if (!data.sub || !isUserRole(data.role)) {
      return null;
    }

    return {
      userId: data.sub,
      role: data.role,
    };
  } catch {
    return null;
  }
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    login: user.login,
    fullName: user.fullName,
    role: user.role,
    active: user.active,
  };
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "operator" || value === "admin";
}
