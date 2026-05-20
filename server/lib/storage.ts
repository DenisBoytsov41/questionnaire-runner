import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppStorage } from "../types.js";
import { createId, hashPassword } from "./crypto.js";

const storagePath = resolve(process.cwd(), "server", "data", "storage.json");

const emptyStorage: AppStorage = {
  users: [],
  questionnaires: [],
  questionnaireVersions: [],
  runs: [],
};

export async function readStorage(): Promise<AppStorage> {
  try {
    const rawStorage = await readFile(storagePath, "utf8");

    return {
      ...emptyStorage,
      ...JSON.parse(rawStorage),
    } as AppStorage;
  } catch {
    const storage = await createInitialStorage();
    await writeStorage(storage);

    return storage;
  }
}

export async function writeStorage(storage: AppStorage): Promise<void> {
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(storage, null, 2), "utf8");
}

export async function updateStorage<T>(updater: (storage: AppStorage) => T): Promise<T> {
  const storage = await readStorage();
  const result = updater(storage);

  await writeStorage(storage);

  return result;
}

async function createInitialStorage(): Promise<AppStorage> {
  const now = new Date().toISOString();
  const adminLogin = process.env.ADMIN_LOGIN?.trim() || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin123";
  const { hash, salt } = hashPassword(adminPassword);

  return {
    ...emptyStorage,
    users: [
      {
        id: createId("usr"),
        login: adminLogin,
        fullName: "Администратор",
        role: "admin",
        active: true,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
