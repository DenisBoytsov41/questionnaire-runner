import { useEffect, useRef, useState } from "react";
import { singleQuestionnaireSchema } from "./entities/questionnaire/schema";
import type { Questionnaire } from "./entities/questionnaire/types";
import { validateQuestionnaireContract } from "./entities/questionnaire/validation";
import { AdminQuestionnairesPage } from "./pages/AdminQuestionnairesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { LoginPage } from "./pages/LoginPage";
import { MyRunsPage } from "./pages/MyRunsPage";
import { ProfilePanel } from "./pages/ProfilePanel";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { QuestionnaireSelectPage } from "./pages/QuestionnaireSelectPage";
import { ScenarioCatalogPage } from "./pages/ScenarioCatalogPage";
import type {
  CurrentUser,
  AdminQuestionnaire,
  AdminQuestionnairesSummary,
  AdminUser,
  AdminUsersSummary,
  ChangePasswordInput,
  CreateAdminUserInput,
  ImportQuestionnairesResult,
  ListPageParams,
  PaginationMeta,
  PublishedQuestionnaire,
  QuestionnaireRun,
  QuestionnaireRunsSummary,
  UpdateProfileInput,
  UserPreferences,
  UserRole,
} from "./shared/api/backendApi";
import {
  changeCurrentUserPassword,
  createAdminUser,
  createQuestionnaireRun,
  deleteAdminQuestionnaire,
  deleteAdminQuestionnaireVersion,
  deleteQuestionnaireRunDraft,
  defaultUserPreferences,
  importQuestionnairesToBackend,
  loadAdminQuestionnairesPage,
  loadCurrentUser,
  loadPublishedQuestionnaire,
  loadPublishedQuestionnairesPage,
  loadQuestionnaireRunsPage,
  loadUsersPage,
  publishAdminQuestionnaireVersion,
  updateCurrentUserProfile,
  updateUserAccess,
} from "./shared/api/backendApi";
import { BrandHeader, type SettingsStatus } from "./shared/ui/BrandHeader";
import { compressProfileImage } from "./shared/lib/profileImage";
import { isAdminRole } from "./shared/lib/access";
import "./App.css";

const authTokenStorageKey = "ks-questionnaire-auth-token";
const oversizedAvatarDataLength = 300_000;

const emptyPagination: PaginationMeta = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
};

const emptyAdminQuestionnairesSummary: AdminQuestionnairesSummary = {
  totalQuestionnaires: 0,
  totalVersions: 0,
  activeQuestionnaires: 0,
};

const emptyRunsSummary: QuestionnaireRunsSummary = {
  totalRuns: 0,
  draftRuns: 0,
  finishedRuns: 0,
};

const emptyAdminUsersSummary: AdminUsersSummary = {
  totalUsers: 0,
  operatorUsers: 0,
  noAccessUsers: 0,
};

const catalogInitialParams: Required<Pick<ListPageParams, "page" | "pageSize" | "search">> = {
  page: 1,
  pageSize: 5,
  search: "",
};

const runsInitialParams: Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "status">> = {
  page: 1,
  pageSize: 5,
  search: "",
  status: "all",
};

const adminUsersInitialParams: Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "role">> = {
  page: 1,
  pageSize: 5,
  search: "",
  role: "all",
};

const adminQuestionnairesInitialParams: Required<Pick<ListPageParams, "page" | "pageSize" | "search">> = {
  page: 1,
  pageSize: 5,
  search: "",
};

function replaceUserInList(users: AdminUser[], user: CurrentUser): AdminUser[] {
  return users.map((item) => (item.id === user.id ? user : item));
}

function App() {
  const [authToken, setAuthToken] = useState(() => readStoredToken());
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "ready">(() =>
    readStoredToken() ? "checking" : "ready",
  );
  const [authError, setAuthError] = useState("");
  const [publishedQuestionnaires, setPublishedQuestionnaires] = useState<PublishedQuestionnaire[]>([]);
  const [catalogParams, setCatalogParams] = useState(catalogInitialParams);
  const [catalogPagination, setCatalogPagination] = useState<PaginationMeta>({
    ...emptyPagination,
    pageSize: catalogInitialParams.pageSize,
  });
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogError, setCatalogError] = useState("");
  const [runs, setRuns] = useState<QuestionnaireRun[]>([]);
  const [runsParams, setRunsParams] = useState(runsInitialParams);
  const [runsPagination, setRunsPagination] = useState<PaginationMeta>({
    ...emptyPagination,
    pageSize: runsInitialParams.pageSize,
  });
  const [runsSummary, setRunsSummary] = useState<QuestionnaireRunsSummary>(emptyRunsSummary);
  const [runsStatus, setRunsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [runsError, setRunsError] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersSummary, setAdminUsersSummary] = useState<AdminUsersSummary>(emptyAdminUsersSummary);
  const [adminUsersParams, setAdminUsersParams] = useState(adminUsersInitialParams);
  const [adminUsersPagination, setAdminUsersPagination] = useState<PaginationMeta>({
    ...emptyPagination,
    pageSize: adminUsersInitialParams.pageSize,
  });
  const [adminUsersStatus, setAdminUsersStatus] = useState<"loading" | "ready" | "error">("loading");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminQuestionnaires, setAdminQuestionnaires] = useState<AdminQuestionnaire[]>([]);
  const [adminQuestionnairesParams, setAdminQuestionnairesParams] = useState(adminQuestionnairesInitialParams);
  const [adminQuestionnairesPagination, setAdminQuestionnairesPagination] = useState<PaginationMeta>({
    ...emptyPagination,
    pageSize: adminQuestionnairesInitialParams.pageSize,
  });
  const [adminQuestionnairesSummary, setAdminQuestionnairesSummary] = useState<AdminQuestionnairesSummary>(
    emptyAdminQuestionnairesSummary,
  );
  const [adminQuestionnairesStatus, setAdminQuestionnairesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [adminQuestionnairesError, setAdminQuestionnairesError] = useState("");
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [questionnaireSource, setQuestionnaireSource] = useState<"backend" | "file">("backend");
  const [activeRunId, setActiveRunId] = useState("");
  const [activeRunSnapshot, setActiveRunSnapshot] = useState<QuestionnaireRun | null>(null);
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [isRunsPageOpen, setIsRunsPageOpen] = useState(false);
  const [isAdminUsersPageOpen, setIsAdminUsersPageOpen] = useState(false);
  const [isAdminQuestionnairesPageOpen, setIsAdminQuestionnairesPageOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>("idle");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const preferencesSaveVersionRef = useRef(0);
  const preferencesSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const activePreferences = currentUser?.preferences ?? defaultUserPreferences;
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;
  const currentUserIsAdmin = currentUser ? isAdminRole(currentUser.role) : false;

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.textScale = activePreferences.textSize;
    root.dataset.theme = activePreferences.theme;
    root.dataset.vision = activePreferences.readingMode;
  }, [activePreferences]);

  useEffect(() => {
    if (!authToken || currentUser) {
      return;
    }

    let isCancelled = false;

    loadCurrentUser(authToken)
      .then((user) => {
        if (isCancelled) {
          return;
        }

        setCurrentUser(user);
        setAuthError("");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        clearStoredToken();
        setAuthToken("");
        setCurrentUser(null);
        setAuthError(error instanceof Error ? error.message : "Сессия завершена. Войдите заново.");
      })
      .finally(() => {
        if (!isCancelled) {
          setAuthStatus("ready");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authToken, currentUser]);

  useEffect(() => {
    const avatarImage = currentUser?.preferences.avatarImage ?? "";

    if (!authToken || !currentUser || avatarImage.length <= oversizedAvatarDataLength) {
      return;
    }

    let isCancelled = false;

    compressProfileImage(avatarImage)
      .then((compressedAvatar) => {
        if (isCancelled || compressedAvatar.length >= avatarImage.length) {
          return null;
        }

        return updateCurrentUserProfile(authToken, {
          preferences: {
            ...currentUser.preferences,
            avatarImage: compressedAvatar,
          },
        });
      })
      .then((updatedUser) => {
        if (!updatedUser || isCancelled) {
          return;
        }

        setCurrentUser(updatedUser);
        setAdminUsers((items) => replaceUserInList(items, updatedUser));
      })
      .catch(() => {
        // The original avatar remains available if browser-side optimization fails.
      });

    return () => {
      isCancelled = true;
    };
  }, [authToken, currentUser]);

  useEffect(() => {
    if (!authToken || !currentUserId || currentUserRole === "user") {
      return;
    }

    let isCancelled = false;

    loadPublishedQuestionnairesPage(authToken, catalogParams)
      .then((page) => {
        if (isCancelled) {
          return;
        }

        setPublishedQuestionnaires(page.items);
        setCatalogPagination(page.pagination);
        setCatalogStatus("ready");
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setPublishedQuestionnaires([]);
        setCatalogStatus("error");
        setCatalogError(
          error instanceof Error
            ? error.message
            : "Не удалось получить список опубликованных сценариев.",
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [authToken, catalogParams, currentUserId, currentUserRole]);

  async function refreshPublishedQuestionnaires() {
    if (!authToken) {
      return;
    }

    setCatalogStatus("loading");
    setCatalogError("");

    try {
      const page = await loadPublishedQuestionnairesPage(authToken, catalogParams);
      setPublishedQuestionnaires(page.items);
      setCatalogPagination(page.pagination);
      setCatalogStatus("ready");
    } catch (error) {
      setPublishedQuestionnaires([]);
      setCatalogStatus("error");
      setCatalogError(
        error instanceof Error
          ? error.message
          : "Не удалось получить список опубликованных сценариев.",
      );
    }
  }

  async function refreshRuns() {
    if (!authToken) {
      return;
    }

    setRunsStatus("loading");
    setRunsError("");

    try {
      const page = await loadQuestionnaireRunsPage(authToken, runsParams);
      setRuns(page.items);
      setRunsPagination(page.pagination);
      setRunsSummary(page.summary);
      setRunsStatus("ready");
    } catch (error) {
      setRuns([]);
      setRunsSummary(emptyRunsSummary);
      setRunsStatus("error");
      setRunsError(error instanceof Error ? error.message : "Не удалось получить список прохождений.");
    }
  }

  async function refreshAdminUsers() {
    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    setAdminUsersStatus("loading");
    setAdminUsersError("");

    try {
      const page = await loadUsersPage(authToken, adminUsersParams);
      setAdminUsers(page.items);
      setAdminUsersPagination(page.pagination);
      setAdminUsersSummary(page.summary);
      setAdminUsersStatus("ready");
    } catch (error) {
      setAdminUsers([]);
      setAdminUsersSummary(emptyAdminUsersSummary);
      setAdminUsersStatus("error");
      setAdminUsersError(error instanceof Error ? error.message : "Не удалось получить список пользователей.");
    }
  }

  async function refreshAdminQuestionnaires() {
    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    setAdminQuestionnairesStatus("loading");
    setAdminQuestionnairesError("");

    try {
      const page = await loadAdminQuestionnairesPage(authToken, adminQuestionnairesParams);
      setAdminQuestionnaires(page.items);
      setAdminQuestionnairesPagination(page.pagination);
      setAdminQuestionnairesSummary(page.summary);
      setAdminQuestionnairesStatus("ready");
    } catch (error) {
      setAdminQuestionnaires([]);
      setAdminQuestionnairesSummary(emptyAdminQuestionnairesSummary);
      setAdminQuestionnairesStatus("error");
      setAdminQuestionnairesError(
        error instanceof Error ? error.message : "Не удалось получить список сценариев из базы.",
      );
    }
  }

  function handleCatalogPageChange(page: number) {
    setCatalogParams((current) => ({ ...current, page }));
  }

  function handleCatalogPageSizeChange(pageSize: number) {
    setCatalogParams((current) => ({ ...current, page: 1, pageSize }));
  }

  function handleRunsParamsChange(input: Partial<typeof runsParams>) {
    const nextParams = {
      ...runsParams,
      ...input,
      page: input.page ?? 1,
    };

    setRunsParams(nextParams);

    if (!authToken) {
      return;
    }

    setRunsStatus("loading");
    setRunsError("");

    void loadQuestionnaireRunsPage(authToken, nextParams)
      .then((page) => {
        setRuns(page.items);
        setRunsPagination(page.pagination);
        setRunsSummary(page.summary);
        setRunsStatus("ready");
      })
      .catch((error) => {
        setRuns([]);
        setRunsSummary(emptyRunsSummary);
        setRunsStatus("error");
        setRunsError(error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РїСЂРѕС…РѕР¶РґРµРЅРёР№.");
      });
  }

  function handleAdminUsersParamsChange(input: Partial<typeof adminUsersParams>) {
    const nextParams = {
      ...adminUsersParams,
      ...input,
      page: input.page ?? 1,
    };

    setAdminUsersParams(nextParams);

    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    setAdminUsersStatus("loading");
    setAdminUsersError("");

    void loadUsersPage(authToken, nextParams)
      .then((page) => {
        setAdminUsers(page.items);
        setAdminUsersPagination(page.pagination);
        setAdminUsersSummary(page.summary);
        setAdminUsersStatus("ready");
      })
      .catch((error) => {
        setAdminUsers([]);
        setAdminUsersSummary(emptyAdminUsersSummary);
        setAdminUsersStatus("error");
        setAdminUsersError(error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.");
      });
  }

  function handleAdminQuestionnairesParamsChange(input: Partial<typeof adminQuestionnairesParams>) {
    const nextParams = {
      ...adminQuestionnairesParams,
      ...input,
      page: input.page ?? 1,
    };

    setAdminQuestionnairesParams(nextParams);

    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    setAdminQuestionnairesStatus("loading");
    setAdminQuestionnairesError("");

    void loadAdminQuestionnairesPage(authToken, nextParams)
      .then((page) => {
        setAdminQuestionnaires(page.items);
        setAdminQuestionnairesPagination(page.pagination);
        setAdminQuestionnairesSummary(page.summary);
        setAdminQuestionnairesStatus("ready");
      })
      .catch((error) => {
        setAdminQuestionnaires([]);
        setAdminQuestionnairesSummary(emptyAdminQuestionnairesSummary);
        setAdminQuestionnairesStatus("error");
        setAdminQuestionnairesError(
          error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє СЃС†РµРЅР°СЂРёРµРІ РёР· Р±Р°Р·С‹.",
        );
      });
  }

  function handleOpenRunsPage() {
    setIsRunsPageOpen(true);
    setIsManualUploadOpen(false);
    setIsAdminUsersPageOpen(false);
    setIsAdminQuestionnairesPageOpen(false);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setActiveRunSnapshot(null);
    void refreshRuns();
  }

  function handleOpenAdminUsersPage() {
    setIsAdminUsersPageOpen(true);
    setIsRunsPageOpen(false);
    setIsManualUploadOpen(false);
    setIsAdminQuestionnairesPageOpen(false);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setActiveRunSnapshot(null);
    void refreshAdminUsers();
  }

  function handleOpenAdminQuestionnairesPage() {
    setIsAdminQuestionnairesPageOpen(true);
    setIsAdminUsersPageOpen(false);
    setIsRunsPageOpen(false);
    setIsManualUploadOpen(false);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setActiveRunSnapshot(null);
    void refreshAdminQuestionnaires();
  }

  function handleBackToCatalog() {
    setIsAdminUsersPageOpen(false);
    setIsAdminQuestionnairesPageOpen(false);
    setIsRunsPageOpen(false);
    setIsManualUploadOpen(false);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setActiveRunSnapshot(null);
  }

  async function handleUpdateUserAccess(userId: string, input: { role: UserRole; active: boolean }) {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    const updatedUser = await updateUserAccess(authToken, userId, input);

    setAdminUsers((items) => items.map((item) => (item.id === updatedUser.id ? updatedUser : item)));

    if (updatedUser.id === currentUser?.id) {
      setCurrentUser(updatedUser);
    }
  }

  async function handleCreateAdminUser(input: CreateAdminUserInput) {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    const createdUser = await createAdminUser(authToken, input);
    setAdminUsers((items) => [createdUser, ...items.filter((item) => item.id !== createdUser.id)]);
    handleAdminUsersParamsChange({ page: 1 });
  }

  async function handleImportAdminQuestionnaires(input: unknown): Promise<ImportQuestionnairesResult[]> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    const result = await importQuestionnairesToBackend(authToken, input);
    await refreshPublishedQuestionnaires();

    return result;
  }

  async function handlePublishAdminQuestionnaireVersion(questionnaireId: string, versionId: string): Promise<void> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    await publishAdminQuestionnaireVersion(authToken, questionnaireId, versionId);
    await refreshPublishedQuestionnaires();
  }

  async function handleDeleteAdminQuestionnaire(questionnaireId: string): Promise<void> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    await deleteAdminQuestionnaire(authToken, questionnaireId);
    await refreshPublishedQuestionnaires();
  }

  async function handleDeleteAdminQuestionnaireVersion(
    questionnaireId: string,
    versionId: string,
  ): Promise<void> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    await deleteAdminQuestionnaireVersion(authToken, questionnaireId, versionId);
    await refreshPublishedQuestionnaires();
  }

  async function handleOpenPublishedQuestionnaireById(questionnaireId: string): Promise<void> {
    const questionnaire = publishedQuestionnaires.find((item) => item.id === questionnaireId);

    if (questionnaire) {
      await handlePublishedQuestionnaireSelect(questionnaire);
      return;
    }

    if (!authToken) {
      setAdminQuestionnairesError("Сессия завершена. Войдите заново.");
      return;
    }

    await openPublishedQuestionnaire(questionnaireId);
  }

  async function handleDeleteDraftRun(run: QuestionnaireRun): Promise<void> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    if (run.status !== "draft") {
      throw new Error("Удалить можно только черновик.");
    }

    await deleteQuestionnaireRunDraft(authToken, run.id);
    await refreshRuns();
  }

  async function handlePublishedQuestionnaireSelect(questionnaire: PublishedQuestionnaire) {
    await openPublishedQuestionnaire(questionnaire.id);
  }

  async function openPublishedQuestionnaire(questionnaireId: string) {
    if (!authToken) {
      setCatalogError("Сессия завершена. Войдите заново.");
      return;
    }

    setCatalogError("");
    setCatalogStatus("loading");

    try {
      const details = await loadPublishedQuestionnaire(authToken, questionnaireId);
      const parsed = singleQuestionnaireSchema.safeParse(details.source);

      if (!parsed.success) {
        setCatalogStatus("ready");
        setCatalogError("Сценарий получен из базы, но его структура не прошла проверку.");
        return;
      }

      const contractErrors = validateQuestionnaireContract(parsed.data);

      if (contractErrors.length > 0) {
        setCatalogStatus("ready");
        setCatalogError(`Сценарий получен из базы, но содержит ошибки: ${contractErrors.join("; ")}`);
        return;
      }

      const run = await createQuestionnaireRun(authToken, questionnaireId);

      setSelectedQuestionnaire(parsed.data);
      setQuestionnaireSource("backend");
      setActiveRunId(run.id);
      setActiveRunSnapshot(run);
      setIsManualUploadOpen(false);
      setIsRunsPageOpen(false);
      setIsAdminUsersPageOpen(false);
      setIsAdminQuestionnairesPageOpen(false);
      setQuestionnaires([]);
      setCatalogStatus("ready");
    } catch (error) {
      setCatalogStatus("ready");
      setCatalogError(error instanceof Error ? error.message : "Не удалось открыть выбранный сценарий.");
    }
  }

  async function handleContinueRun(run: QuestionnaireRun) {
    if (!authToken) {
      setRunsError("Сессия завершена. Войдите заново.");
      return;
    }

    if (run.status !== "draft") {
      setRunsError("Продолжить можно только незавершённый черновик.");
      return;
    }

    setRunsStatus("loading");
    setRunsError("");

    try {
      const details = await loadPublishedQuestionnaire(authToken, run.questionnaireId);
      const parsed = singleQuestionnaireSchema.safeParse(details.source);

      if (!parsed.success) {
        setRunsStatus("ready");
        setRunsError("Сценарий для черновика найден, но его структура не прошла проверку.");
        return;
      }

      const contractErrors = validateQuestionnaireContract(parsed.data);

      if (contractErrors.length > 0) {
        setRunsStatus("ready");
        setRunsError(`Сценарий для черновика содержит ошибки: ${contractErrors.join("; ")}`);
        return;
      }

      setSelectedQuestionnaire(parsed.data);
      setQuestionnaireSource("backend");
      setActiveRunId(run.id);
      setActiveRunSnapshot(run);
      setIsManualUploadOpen(false);
      setIsRunsPageOpen(false);
      setIsAdminUsersPageOpen(false);
      setIsAdminQuestionnairesPageOpen(false);
      setQuestionnaires([]);
      setRunsStatus("ready");
    } catch (error) {
      setRunsStatus("ready");
      setRunsError(error instanceof Error ? error.message : "Не удалось продолжить черновик.");
    }
  }

  function handleQuestionnairesLoaded(loadedQuestionnaires: Questionnaire[]) {
    setQuestionnaires(loadedQuestionnaires);
    setLoadError("");
    setQuestionnaireSource("file");
    setActiveRunId("");
    setActiveRunSnapshot(null);
    setIsRunsPageOpen(false);
    setIsAdminUsersPageOpen(false);
    setIsAdminQuestionnairesPageOpen(false);

    if (loadedQuestionnaires.length === 1) {
      setSelectedQuestionnaire(loadedQuestionnaires[0]);
      return;
    }

    setSelectedQuestionnaire(null);
  }

  function handleOpenManualUpload() {
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setLoadError("");
    setIsManualUploadOpen(true);
    setIsRunsPageOpen(false);
    setIsAdminUsersPageOpen(false);
    setIsAdminQuestionnairesPageOpen(false);
    setQuestionnaireSource("file");
    setActiveRunId("");
    setActiveRunSnapshot(null);
  }

  function handleLogin(token: string, user: CurrentUser) {
    localStorage.setItem(authTokenStorageKey, token);
    setAuthToken(token);
    setCurrentUser(user);
    setAuthError("");
    setAuthStatus("ready");
    setCatalogStatus("loading");
    setCatalogError("");
  }

  function handleLogout() {
    clearStoredToken();
    setAuthToken("");
    setCurrentUser(null);
    setAuthError("");
    setPublishedQuestionnaires([]);
    setRuns([]);
    setRunsSummary(emptyRunsSummary);
    setAdminUsers([]);
    setAdminQuestionnaires([]);
    setAdminQuestionnairesSummary(emptyAdminQuestionnairesSummary);
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setActiveRunSnapshot(null);
    setIsManualUploadOpen(false);
    setIsRunsPageOpen(false);
    setIsAdminUsersPageOpen(false);
    setIsAdminQuestionnairesPageOpen(false);
    setCatalogError("");
    setRunsError("");
    setAdminUsersError("");
    setLoadError("");
    setIsProfileOpen(false);
  }

  async function handlePreferencesChange(preferences: UserPreferences) {
    if (!authToken || !currentUser) {
      return;
    }

    const previousUser = currentUser;
    const optimisticUser = { ...currentUser, preferences };
    const saveVersion = preferencesSaveVersionRef.current + 1;

    preferencesSaveVersionRef.current = saveVersion;
    setCurrentUser(optimisticUser);
    setAdminUsers((items) => replaceUserInList(items, optimisticUser));
    setSettingsStatus("saving");

    preferencesSaveQueueRef.current = preferencesSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const updatedUser = await updateCurrentUserProfile(authToken, { preferences });

          if (preferencesSaveVersionRef.current !== saveVersion) {
            return;
          }

          setCurrentUser(updatedUser);
          setAdminUsers((items) => replaceUserInList(items, updatedUser));
          setSettingsStatus("saved");
        } catch {
          if (preferencesSaveVersionRef.current !== saveVersion) {
            return;
          }

          setCurrentUser(previousUser);
          setAdminUsers((items) => replaceUserInList(items, previousUser));
          setSettingsStatus("error");
        }
      });
  }

  async function handleProfileSave(input: UpdateProfileInput) {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    const updatedUser = await updateCurrentUserProfile(authToken, input);
    setCurrentUser(updatedUser);
    setAdminUsers((items) => replaceUserInList(items, updatedUser));
  }

  async function handlePasswordChange(input: ChangePasswordInput) {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    await changeCurrentUserPassword(authToken, input);
  }

  const sharedHeaderProps = currentUser
    ? {
        user: currentUser,
        settings: activePreferences,
        settingsStatus,
        navigationItems: [
          ...(selectedQuestionnaire
            ? [
                {
                  label: "Текущий опрос",
                  description: "Продолжить открытый сценарий",
                  active: true,
                  onClick: () => undefined,
                },
              ]
            : []),
          {
            label: "Сценарии",
            description: "Выбор рабочего сценария",
            active:
              !selectedQuestionnaire
              && !isRunsPageOpen
              && !isAdminUsersPageOpen
              && !isAdminQuestionnairesPageOpen
              && !isManualUploadOpen,
            onClick: handleBackToCatalog,
          },
          {
            label: "Мои прохождения",
            description: "Черновики и завершённые опросы",
            active: isRunsPageOpen,
            onClick: handleOpenRunsPage,
          },
          ...(isAdminRole(currentUser.role)
            ? [
                {
                  label: "Сценарии в базе",
                  description: "Загрузка из 1С и публикация",
                  active: isAdminQuestionnairesPageOpen,
                  onClick: handleOpenAdminQuestionnairesPage,
                },
                {
                  label: "Пользователи",
                  description: "Роли и доступ сотрудников",
                  active: isAdminUsersPageOpen,
                  onClick: handleOpenAdminUsersPage,
                },
              ]
            : []),
          {
            label: "Профиль",
            description: "Контакты и личные настройки",
            active: isProfileOpen,
            onClick: () => setIsProfileOpen(true),
          },
        ],
        onSettingsChange: handlePreferencesChange,
        onOpenProfile: () => setIsProfileOpen(true),
        onLogout: handleLogout,
      }
    : null;

  if (authStatus === "checking") {
    return (
      <main className="app-shell">
        <section className="auth-loading-card">
          <span className="brand-logo-mark">
            <img src="/ks-logo-full.png" alt="К-Сервис" className="brand-logo" />
          </span>
          <strong>Проверяем вход...</strong>
          <p>Сейчас откроем рабочее место, если сессия ещё действует.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} message={authError} />;
  }

  if (currentUser.role === "user" && sharedHeaderProps) {
    return (
      <main className="app-shell">
        <BrandHeader subtitle="Ожидает назначения доступа" {...sharedHeaderProps} />

        <section className="access-denied-card">
          <p className="page-kicker">Доступ пока не открыт</p>
          <h1>Учётная запись создана</h1>
          <p>
            Администратор должен назначить вам роль оператора или администратора. После этого рабочие
            сценарии появятся автоматически.
          </p>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Выйти
          </button>
        </section>

        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </main>
    );
  }

  if (selectedQuestionnaire && sharedHeaderProps) {
    return (
      <>
        <QuestionnaireRunPage
          questionnaire={selectedQuestionnaire}
          backendRun={
            questionnaireSource === "backend" && activeRunId
              ? {
                  token: authToken,
                  runId: activeRunId,
                  initialRun: activeRunSnapshot ?? undefined,
                }
              : undefined
          }
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </>
    );
  }

  if (questionnaires.length > 1 && sharedHeaderProps) {
    return (
      <>
        <QuestionnaireSelectPage
          questionnaires={questionnaires}
          onSelectQuestionnaire={setSelectedQuestionnaire}
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </>
    );
  }

  if (isAdminUsersPageOpen && sharedHeaderProps) {
    return (
      <>
        <AdminUsersPage
          users={adminUsers}
          summary={adminUsersSummary}
          pagination={adminUsersPagination}
          params={adminUsersParams}
          status={adminUsersStatus}
          error={adminUsersError}
          onRefresh={refreshAdminUsers}
          onParamsChange={handleAdminUsersParamsChange}
          onCreateUser={handleCreateAdminUser}
          onUpdateUser={handleUpdateUserAccess}
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </>
    );
  }

  if (isAdminQuestionnairesPageOpen && sharedHeaderProps) {
    return (
      <>
        <AdminQuestionnairesPage
          questionnaires={adminQuestionnaires}
          pagination={adminQuestionnairesPagination}
          summary={adminQuestionnairesSummary}
          params={adminQuestionnairesParams}
          status={adminQuestionnairesStatus}
          error={adminQuestionnairesError}
          onRefresh={refreshAdminQuestionnaires}
          onParamsChange={handleAdminQuestionnairesParamsChange}
          onImportJson={handleImportAdminQuestionnaires}
          onPublishVersion={handlePublishAdminQuestionnaireVersion}
          onDeleteQuestionnaire={handleDeleteAdminQuestionnaire}
          onDeleteVersion={handleDeleteAdminQuestionnaireVersion}
          onOpenAsOperator={handleOpenPublishedQuestionnaireById}
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </>
    );
  }

  if (isRunsPageOpen && sharedHeaderProps) {
    return (
      <>
        <MyRunsPage
          runs={runs}
          questionnaires={publishedQuestionnaires}
          pagination={runsPagination}
          summary={runsSummary}
          params={runsParams}
          status={runsStatus}
          error={runsError}
          onRefresh={refreshRuns}
          onParamsChange={handleRunsParamsChange}
          onContinueRun={handleContinueRun}
          onDeleteDraftRun={handleDeleteDraftRun}
          onBackToCatalog={handleBackToCatalog}
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
            onChangePassword={handlePasswordChange}
          />
        )}
      </>
    );
  }

  return (
    <>
      {sharedHeaderProps && !isManualUploadOpen && (
        <ScenarioCatalogPage
          questionnaires={publishedQuestionnaires}
          pagination={catalogPagination}
          status={catalogStatus}
          error={catalogError}
          onSelectQuestionnaire={handlePublishedQuestionnaireSelect}
          onRefresh={refreshPublishedQuestionnaires}
          onPageChange={handleCatalogPageChange}
          onPageSizeChange={handleCatalogPageSizeChange}
          onOpenManualUpload={handleOpenManualUpload}
          onOpenAdminQuestionnaires={isAdminRole(currentUser.role) ? handleOpenAdminQuestionnairesPage : undefined}
          {...sharedHeaderProps}
        />
      )}

      {sharedHeaderProps && isManualUploadOpen && (
        <main className="app-shell">
          <BrandHeader
            subtitle="Резервная загрузка сценария"
            {...sharedHeaderProps}
          />

          {loadError && (
            <div className="notice-block">
              {loadError.split("\n").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}

          <JsonUploadPage onQuestionnairesLoaded={handleQuestionnairesLoaded} />
        </main>
      )}

      {isProfileOpen && (
        <ProfilePanel
          user={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onSave={handleProfileSave}
          onChangePassword={handlePasswordChange}
        />
      )}
    </>
  );
}

function readStoredToken(): string {
  try {
    return localStorage.getItem(authTokenStorageKey) ?? "";
  } catch {
    return "";
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(authTokenStorageKey);
  } catch {
    // Если браузер не дал доступ к localStorage, достаточно сбросить состояние React.
  }
}

export default App;
