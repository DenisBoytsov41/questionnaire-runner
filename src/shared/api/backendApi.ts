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

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedList<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export type ListPageParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: UserRole | "all";
  status?: QuestionnaireRunStatus | "all";
};

export type UpdateProfileInput = Partial<{
  fullName: string;
  email: string;
  phone: string;
  position: string;
  preferences: UserPreferences;
}>;

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type UpdateUserAccessInput = {
  role: UserRole;
  active: boolean;
};

export type CreateAdminUserInput = {
  login: string;
  password: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  position?: string;
  email?: string;
  phone?: string;
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

export type AdminQuestionnaireVersion = {
  id: string;
  questionnaireId: string;
  version: number;
  title: string;
  active: boolean;
  published: boolean;
  importedBy: string;
  importedAt: string;
};

export type AdminQuestionnaire = {
  id: string;
  title: string;
  activeVersionId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  versions: AdminQuestionnaireVersion[];
};

export type ImportQuestionnairesResult = {
  questionnaireId: string;
  versionId: string;
  version: number;
  title: string;
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

export async function changeCurrentUserPassword(
  token: string,
  input: ChangePasswordInput,
): Promise<void> {
  await apiRequest<{ changed: boolean }>("/api/me/password", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export async function loadUsersPage(
  token: string,
  params: ListPageParams = {},
): Promise<PaginatedList<AdminUser>> {
  const result = await apiRequest<{ users: AdminUser[]; pagination?: PaginationMeta }>(
    `/api/users${buildListQuery(params)}`,
    {
      token,
    },
  );

  return normalizePaginatedList(result.users, result.pagination);
}

export async function createAdminUser(
  token: string,
  input: CreateAdminUserInput,
): Promise<AdminUser> {
  const result = await apiRequest<{ user: AdminUser }>("/api/admin/users", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });

  return result.user;
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

export async function loadPublishedQuestionnairesPage(
  token: string,
  params: ListPageParams = {},
): Promise<PaginatedList<PublishedQuestionnaire>> {
  const result = await apiRequest<{
    questionnaires: PublishedQuestionnaire[];
    pagination?: PaginationMeta;
  }>(`/api/questionnaires${buildListQuery(params)}`, {
    token,
  });

  return normalizePaginatedList(result.questionnaires, result.pagination);
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

export async function loadAdminQuestionnairesPage(
  token: string,
  params: ListPageParams = {},
): Promise<PaginatedList<AdminQuestionnaire>> {
  const result = await apiRequest<{
    questionnaires: AdminQuestionnaire[];
    pagination?: PaginationMeta;
  }>(`/api/admin/questionnaires${buildListQuery(params)}`, {
    token,
  });

  return normalizePaginatedList(result.questionnaires, result.pagination);
}

export async function importQuestionnairesToBackend(
  token: string,
  input: unknown,
): Promise<ImportQuestionnairesResult[]> {
  const result = await apiRequest<{ imported: ImportQuestionnairesResult[] }>("/api/admin/questionnaires/import", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });

  return result.imported;
}

export async function publishAdminQuestionnaireVersion(
  token: string,
  questionnaireId: string,
  versionId: string,
): Promise<void> {
  await apiRequest(
    `/api/admin/questionnaires/${encodeURIComponent(questionnaireId)}/publish`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ versionId }),
    },
  );
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

export async function loadQuestionnaireRunsPage(
  token: string,
  params: ListPageParams = {},
): Promise<PaginatedList<QuestionnaireRun>> {
  const result = await apiRequest<{ runs: QuestionnaireRun[]; pagination?: PaginationMeta }>(
    `/api/questionnaire-runs${buildListQuery(params)}`,
    {
      token,
    },
  );

  return normalizePaginatedList(result.runs, result.pagination);
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

export async function deleteQuestionnaireRunDraft(token: string, runId: string): Promise<void> {
  await apiRequest(`/api/questionnaire-runs/${encodeURIComponent(runId)}`, {
    method: "DELETE",
    token,
  });
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

function buildListQuery(params: ListPageParams): string {
  const query = new URLSearchParams();

  if (params.page) {
    query.set("page", String(params.page));
  }

  if (params.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.role && params.role !== "all") {
    query.set("role", params.role);
  }

  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

function normalizePaginatedList<T>(items: T[], pagination?: PaginationMeta): PaginatedList<T> {
  return {
    items,
    pagination:
      pagination ?? {
        page: 1,
        pageSize: Math.max(items.length, 1),
        totalItems: items.length,
        totalPages: 1,
      },
  };
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}
