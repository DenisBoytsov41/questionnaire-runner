export type UserRole = "user" | "operator" | "admin";

export type UserPreferences = {
  theme: "light" | "dark";
  textSize: "normal" | "large" | "xlarge";
  readingMode: "normal" | "high-contrast";
  profileIcon: "person" | "headset" | "shield" | "star" | "check";
  profileColor: "teal" | "mint" | "blue" | "amber" | "rose";
  avatarImage: string;
};

export const defaultUserPreferences: UserPreferences = {
  theme: "light",
  textSize: "normal",
  readingMode: "normal",
  profileIcon: "person",
  profileColor: "teal",
  avatarImage: "",
};

export type CurrentUser = {
  id: string;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  role: UserRole;
  active: boolean;
  preferences: UserPreferences;
};

export type LoginResult = {
  token: string;
  user: CurrentUser;
};

export type UpdateProfileInput = Partial<{
  fullName: string;
  email: string;
  phone: string;
  position: string;
  preferences: UserPreferences;
}>;

type ApiErrorBody = {
  error?: string;
  details?: string[];
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export async function loginToBackend(login: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export async function loadCurrentUser(token: string): Promise<CurrentUser> {
  const result = await apiRequest<{ user: CurrentUser }>("/api/me", {
    token,
  });

  return result.user;
}

export async function updateCurrentUserProfile(
  token: string,
  input: UpdateProfileInput,
): Promise<CurrentUser> {
  const result = await apiRequest<{ user: CurrentUser }>("/api/me/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });

  return result.user;
}

async function apiRequest<TResponse>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: string;
  } = {},
): Promise<TResponse> {
  const headers = new Headers();

  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
    });
  } catch {
    throw new Error("Не удалось подключиться к серверу. Проверьте, что серверная часть запущена.");
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    const details = body.details?.length ? ` ${body.details.join("; ")}` : "";
    throw new Error(`${body.error ?? `Сервер вернул ошибку ${response.status}.`}${details}`);
  }

  return response.json() as Promise<TResponse>;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}
