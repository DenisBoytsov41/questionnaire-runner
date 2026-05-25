import { useEffect, useState } from "react";
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
  AdminUser,
  ChangePasswordInput,
  CreateAdminUserInput,
  ImportQuestionnairesResult,
  PublishedQuestionnaire,
  QuestionnaireRun,
  UpdateProfileInput,
  UserPreferences,
  UserRole,
} from "./shared/api/backendApi";
import {
  changeCurrentUserPassword,
  createAdminUser,
  createQuestionnaireRun,
  deleteQuestionnaireRunDraft,
  defaultUserPreferences,
  importQuestionnairesToBackend,
  loadAdminQuestionnaires,
  loadCurrentUser,
  loadPublishedQuestionnaire,
  loadPublishedQuestionnaires,
  loadQuestionnaireRuns,
  loadUsers,
  publishAdminQuestionnaireVersion,
  updateCurrentUserProfile,
  updateUserAccess,
} from "./shared/api/backendApi";
import { BrandHeader, type SettingsStatus } from "./shared/ui/BrandHeader";
import "./App.css";

const authTokenStorageKey = "ks-questionnaire-auth-token";

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
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogError, setCatalogError] = useState("");
  const [runs, setRuns] = useState<QuestionnaireRun[]>([]);
  const [runsStatus, setRunsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [runsError, setRunsError] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersStatus, setAdminUsersStatus] = useState<"loading" | "ready" | "error">("loading");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminQuestionnaires, setAdminQuestionnaires] = useState<AdminQuestionnaire[]>([]);
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

  const activePreferences = currentUser?.preferences ?? defaultUserPreferences;
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.textScale = activePreferences.textSize;
    root.dataset.theme = activePreferences.theme;
    root.dataset.vision = activePreferences.readingMode;
  }, [activePreferences]);

  useEffect(() => {
    if (!authToken) {
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
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !currentUserId || currentUserRole === "user") {
      return;
    }

    let isCancelled = false;

    loadPublishedQuestionnaires(authToken)
      .then((items) => {
        if (isCancelled) {
          return;
        }

        setPublishedQuestionnaires(items);
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
  }, [authToken, currentUserId, currentUserRole]);

  async function refreshPublishedQuestionnaires() {
    if (!authToken) {
      return;
    }

    setCatalogStatus("loading");
    setCatalogError("");

    try {
      const items = await loadPublishedQuestionnaires(authToken);
      setPublishedQuestionnaires(items);
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
      const items = await loadQuestionnaireRuns(authToken);
      setRuns(items);
      setRunsStatus("ready");
    } catch (error) {
      setRuns([]);
      setRunsStatus("error");
      setRunsError(error instanceof Error ? error.message : "Не удалось получить список прохождений.");
    }
  }

  async function refreshAdminUsers() {
    if (!authToken || currentUserRole !== "admin") {
      return;
    }

    setAdminUsersStatus("loading");
    setAdminUsersError("");

    try {
      const items = await loadUsers(authToken);
      setAdminUsers(items);
      setAdminUsersStatus("ready");
    } catch (error) {
      setAdminUsers([]);
      setAdminUsersStatus("error");
      setAdminUsersError(error instanceof Error ? error.message : "Не удалось получить список пользователей.");
    }
  }

  async function refreshAdminQuestionnaires() {
    if (!authToken || currentUserRole !== "admin") {
      return;
    }

    setAdminQuestionnairesStatus("loading");
    setAdminQuestionnairesError("");

    try {
      const items = await loadAdminQuestionnaires(authToken);
      setAdminQuestionnaires(items);
      setAdminQuestionnairesStatus("ready");
    } catch (error) {
      setAdminQuestionnaires([]);
      setAdminQuestionnairesStatus("error");
      setAdminQuestionnairesError(
        error instanceof Error ? error.message : "Не удалось получить список сценариев из базы.",
      );
    }
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

    const refreshedItems = await loadPublishedQuestionnaires(authToken);
    setPublishedQuestionnaires(refreshedItems);
    setCatalogStatus("ready");

    const refreshedQuestionnaire = refreshedItems.find((item) => item.id === questionnaireId);

    if (!refreshedQuestionnaire) {
      setAdminQuestionnairesError("Сценарий опубликован, но список оператора ещё не обновился. Нажмите «Обновить» и попробуйте снова.");
      return;
    }

    await handlePublishedQuestionnaireSelect(refreshedQuestionnaire);
  }

  async function handleDeleteDraftRun(run: QuestionnaireRun): Promise<void> {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    if (run.status !== "draft") {
      throw new Error("Удалить можно только черновик.");
    }

    await deleteQuestionnaireRunDraft(authToken, run.id);
    setRuns((items) => items.filter((item) => item.id !== run.id));
  }

  async function handlePublishedQuestionnaireSelect(questionnaire: PublishedQuestionnaire) {
    if (!authToken) {
      setCatalogError("Сессия завершена. Войдите заново.");
      return;
    }

    setCatalogError("");
    setCatalogStatus("loading");

    try {
      const details = await loadPublishedQuestionnaire(authToken, questionnaire.id);
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

      const run = await createQuestionnaireRun(authToken, questionnaire.id);

      setSelectedQuestionnaire(parsed.data);
      setQuestionnaireSource("backend");
      setActiveRunId(run.id);
      setActiveRunSnapshot(null);
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
    setAdminUsers([]);
    setAdminQuestionnaires([]);
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

    setCurrentUser(optimisticUser);
    setAdminUsers((items) => replaceUserInList(items, optimisticUser));
    setSettingsStatus("saving");

    try {
      const updatedUser = await updateCurrentUserProfile(authToken, { preferences });
      setCurrentUser(updatedUser);
      setAdminUsers((items) => replaceUserInList(items, updatedUser));
      setSettingsStatus("saved");
    } catch {
      setCurrentUser(previousUser);
      setAdminUsers((items) => replaceUserInList(items, previousUser));
      setSettingsStatus("error");
    }
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
          ...(currentUser.role === "admin"
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
          status={adminUsersStatus}
          error={adminUsersError}
          onRefresh={refreshAdminUsers}
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
          status={adminQuestionnairesStatus}
          error={adminQuestionnairesError}
          onRefresh={refreshAdminQuestionnaires}
          onImportJson={handleImportAdminQuestionnaires}
          onPublishVersion={handlePublishAdminQuestionnaireVersion}
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
          status={runsStatus}
          error={runsError}
          onRefresh={refreshRuns}
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
          status={catalogStatus}
          error={catalogError}
          onSelectQuestionnaire={handlePublishedQuestionnaireSelect}
          onRefresh={refreshPublishedQuestionnaires}
          onOpenManualUpload={handleOpenManualUpload}
          onOpenAdminQuestionnaires={currentUser.role === "admin" ? handleOpenAdminQuestionnairesPage : undefined}
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
