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

export type AdminUser = CurrentUser;

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

export type UpdateUserAccessInput = {
  role: UserRole;
  active: boolean;
};

export type PublishedQuestionnaire = {
  id: string;
  title: string;
  activeVersionId: string;
  version: number;
  importedAt: string;
};

export type PublishedQuestionnaireDetails = {
  id: string;
  title: string;
  version: number;
  source: unknown;
};

export type QuestionnaireRunStatus = "draft" | "finished";

export type QuestionnaireRunPayload = {
  currentQuestionId?: string | null;
  answers: Record<string, string | string[] | boolean | number | null>;
  route: string[];
  messages: string[];
  verdicts: string[];
  summaryText: string;
};

export type QuestionnaireRun = QuestionnaireRunPayload & {
  id: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  operatorId: string;
  status: QuestionnaireRunStatus;
  currentQuestionId: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
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

export async function loadUsers(token: string): Promise<AdminUser[]> {
  const result = await apiRequest<{ users: AdminUser[] }>("/api/users", {
    token,
  });

  return result.users;
}

export async function updateUserAccess(
  token: string,
  userId: string,
  input: UpdateUserAccessInput,
): Promise<AdminUser> {
  const result = await apiRequest<{ user: AdminUser }>(`/api/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });

  return result.user;
}

export async function loadPublishedQuestionnaires(token: string): Promise<PublishedQuestionnaire[]> {
  const result = await apiRequest<{ questionnaires: PublishedQuestionnaire[] }>("/api/questionnaires", {
    token,
  });

  return result.questionnaires;
}

export async function loadPublishedQuestionnaire(
  token: string,
  questionnaireId: string,
): Promise<PublishedQuestionnaireDetails> {
  const result = await apiRequest<{ questionnaire: PublishedQuestionnaireDetails }>(
    `/api/questionnaires/${encodeURIComponent(questionnaireId)}`,
    {
      token,
    },
  );

  return result.questionnaire;
}

export async function createQuestionnaireRun(
  token: string,
  questionnaireId: string,
): Promise<QuestionnaireRun> {
  const result = await apiRequest<{ run: QuestionnaireRun }>("/api/questionnaire-runs", {
    method: "POST",
    token,
    body: JSON.stringify({ questionnaireId }),
  });

  return result.run;
}

export async function loadQuestionnaireRuns(token: string): Promise<QuestionnaireRun[]> {
  const result = await apiRequest<{ runs: QuestionnaireRun[] }>("/api/questionnaire-runs", {
    token,
  });

  return result.runs;
}

export async function loadQuestionnaireRun(token: string, runId: string): Promise<QuestionnaireRun> {
  const result = await apiRequest<{ run: QuestionnaireRun }>(
    `/api/questionnaire-runs/${encodeURIComponent(runId)}`,
    {
      token,
    },
  );

  return result.run;
}

export async function saveQuestionnaireRunDraft(
  token: string,
  runId: string,
  payload: QuestionnaireRunPayload,
): Promise<QuestionnaireRun> {
  const result = await apiRequest<{ run: QuestionnaireRun }>(`/api/questionnaire-runs/${runId}/draft`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

  return result.run;
}

export async function finishQuestionnaireRun(
  token: string,
  runId: string,
  payload: QuestionnaireRunPayload,
): Promise<QuestionnaireRun> {
  const result = await apiRequest<{ run: QuestionnaireRun }>(`/api/questionnaire-runs/${runId}/finish`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return result.run;
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
