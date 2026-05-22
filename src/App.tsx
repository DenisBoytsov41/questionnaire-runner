import { useEffect, useState } from "react";
import { singleQuestionnaireSchema } from "./entities/questionnaire/schema";
import type { Questionnaire } from "./entities/questionnaire/types";
import { validateQuestionnaireContract } from "./entities/questionnaire/validation";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePanel } from "./pages/ProfilePanel";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { QuestionnaireSelectPage } from "./pages/QuestionnaireSelectPage";
import { ScenarioCatalogPage } from "./pages/ScenarioCatalogPage";
import type {
  CurrentUser,
  PublishedQuestionnaire,
  UpdateProfileInput,
  UserPreferences,
} from "./shared/api/backendApi";
import {
  createQuestionnaireRun,
  defaultUserPreferences,
  loadCurrentUser,
  loadPublishedQuestionnaire,
  loadPublishedQuestionnaires,
  updateCurrentUserProfile,
} from "./shared/api/backendApi";
import { BrandHeader, type SettingsStatus } from "./shared/ui/BrandHeader";
import "./App.css";

const authTokenStorageKey = "ks-questionnaire-auth-token";

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
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [questionnaireSource, setQuestionnaireSource] = useState<"backend" | "file">("backend");
  const [activeRunId, setActiveRunId] = useState("");
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
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
      setIsManualUploadOpen(false);
      setQuestionnaires([]);
      setCatalogStatus("ready");
    } catch (error) {
      setCatalogStatus("ready");
      setCatalogError(error instanceof Error ? error.message : "Не удалось открыть выбранный сценарий.");
    }
  }

  function handleQuestionnairesLoaded(loadedQuestionnaires: Questionnaire[]) {
    setQuestionnaires(loadedQuestionnaires);
    setLoadError("");
    setQuestionnaireSource("file");
    setActiveRunId("");

    if (loadedQuestionnaires.length === 1) {
      setSelectedQuestionnaire(loadedQuestionnaires[0]);
      return;
    }

    setSelectedQuestionnaire(null);
  }

  function handleResetAll() {
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setLoadError("");
    setIsManualUploadOpen(false);
    setQuestionnaireSource("backend");
    setActiveRunId("");
  }

  function handleOpenManualUpload() {
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setLoadError("");
    setIsManualUploadOpen(true);
    setQuestionnaireSource("file");
    setActiveRunId("");
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
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setActiveRunId("");
    setIsManualUploadOpen(false);
    setCatalogError("");
    setLoadError("");
    setIsProfileOpen(false);
  }

  async function handlePreferencesChange(preferences: UserPreferences) {
    if (!authToken || !currentUser) {
      return;
    }

    const previousUser = currentUser;

    setCurrentUser({ ...currentUser, preferences });
    setSettingsStatus("saving");

    try {
      const updatedUser = await updateCurrentUserProfile(authToken, { preferences });
      setCurrentUser(updatedUser);
      setSettingsStatus("saved");
    } catch {
      setCurrentUser(previousUser);
      setSettingsStatus("error");
    }
  }

  async function handleProfileSave(input: UpdateProfileInput) {
    if (!authToken) {
      throw new Error("Сессия завершена. Войдите заново.");
    }

    const updatedUser = await updateCurrentUserProfile(authToken, input);
    setCurrentUser(updatedUser);
  }

  const sharedHeaderProps = currentUser
    ? {
        user: currentUser,
        settings: activePreferences,
        settingsStatus,
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
          onResetQuestionnaire={() => {
            setSelectedQuestionnaire(null);
            setActiveRunId("");
          }}
          resetLabel={questionnaireSource === "backend" ? "К списку сценариев" : "Выбрать другой файл"}
          backendRun={
            questionnaireSource === "backend" && activeRunId
              ? {
                  token: authToken,
                  runId: activeRunId,
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
          onReset={handleOpenManualUpload}
          {...sharedHeaderProps}
        />
        {isProfileOpen && (
          <ProfilePanel
            user={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onSave={handleProfileSave}
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
          {...sharedHeaderProps}
        />
      )}

      {sharedHeaderProps && isManualUploadOpen && (
        <main className="app-shell">
          <BrandHeader
            subtitle="Резервная загрузка сценария"
            action={{
              label: "К списку сценариев",
              onClick: handleResetAll,
            }}
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
