import { useEffect, useState } from "react";
import type { Questionnaire } from "./entities/questionnaire/types";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePanel } from "./pages/ProfilePanel";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { QuestionnaireSelectPage } from "./pages/QuestionnaireSelectPage";
import type { CurrentUser, UpdateProfileInput, UserPreferences } from "./shared/api/backendApi";
import {
  defaultUserPreferences,
  loadCurrentUser,
  updateCurrentUserProfile,
} from "./shared/api/backendApi";
import { loadQuestionnaireFromPublic } from "./shared/api/questionnaireApi";
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
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] =
    useState<Questionnaire | null>(null);
  const [loadError, setLoadError] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>("idle");
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const activePreferences = currentUser?.preferences ?? defaultUserPreferences;

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
    if (!currentUser || currentUser.role === "user") {
      return;
    }

    loadQuestionnaireFromPublic("Чек-лист звонка по ККТ.json").then((result) => {
      if (result.ok) {
        setQuestionnaires(result.questionnaires);
        setLoadError("");

        if (result.questionnaires.length === 1) {
          setSelectedQuestionnaire(result.questionnaires[0]);
        }

        return;
      }

      setLoadError(
        [
          "Тестовый файл public/questionnaires/Чек-лист звонка по ККТ.json не найден или содержит ошибки.",
          "Можно загрузить файл сценария вручную.",
          ...result.errors,
        ].join("\n"),
      );
    });
  }, [currentUser]);

  function handleQuestionnairesLoaded(loadedQuestionnaires: Questionnaire[]) {
    setQuestionnaires(loadedQuestionnaires);
    setLoadError("");

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
  }

  function handleLogin(token: string, user: CurrentUser) {
    localStorage.setItem(authTokenStorageKey, token);
    setAuthToken(token);
    setCurrentUser(user);
    setAuthError("");
    setAuthStatus("ready");
  }

  function handleLogout() {
    clearStoredToken();
    setAuthToken("");
    setCurrentUser(null);
    setAuthError("");
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
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
          onResetQuestionnaire={() => setSelectedQuestionnaire(null)}
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
          onReset={handleResetAll}
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
    <main className="app-shell">
      {sharedHeaderProps && <BrandHeader subtitle="Загрузка сценария из 1С" {...sharedHeaderProps} />}

      {loadError && (
        <div className="notice-block">
          {loadError.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <JsonUploadPage onQuestionnairesLoaded={handleQuestionnairesLoaded} />

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
