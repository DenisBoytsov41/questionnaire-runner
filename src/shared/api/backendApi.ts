export type UserRole = "user" | "operator" | "admin";

export type UserPreferences = {
  theme: "light" | "dark";
  textSize: "normal" | "large" | "xlarge";
  readingMode: "normal" | "high-contrast";
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
    throw new Error("Не удалось подключиться к серверу. Проверьте, что backend запущен.");
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
