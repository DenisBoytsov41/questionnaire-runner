import type { CurrentUser, PublishedQuestionnaire, UserPreferences } from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";

interface ScenarioCatalogPageProps {
  questionnaires: PublishedQuestionnaire[];
  status: "loading" | "ready" | "error";
  error: string;
  onSelectQuestionnaire: (questionnaire: PublishedQuestionnaire) => void;
  onRefresh: () => void;
  onOpenManualUpload: () => void;
  onOpenRuns: () => void;
  onOpenAdminUsers: () => void;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function ScenarioCatalogPage({
  questionnaires,
  status,
  error,
  onSelectQuestionnaire,
  onRefresh,
  onOpenManualUpload,
  onOpenRuns,
  onOpenAdminUsers,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: ScenarioCatalogPageProps) {
  const isLoading = status === "loading";

  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Рабочее место оператора"
        action={{
          label: "Загрузить файл вручную",
          onClick: onOpenManualUpload,
        }}
        navigationItems={navigationItems}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <section className="select-page scenario-catalog-page">
        <div className="select-header scenario-catalog-header">
          <div>
            <p className="page-kicker">Сценарии из базы</p>
            <h1>Выберите рабочий сценарий</h1>
            <p>
              Здесь показаны опубликованные опросники из базы. Оператор запускает сценарий отсюда,
              а ручная загрузка файла остаётся запасным вариантом для проверки.
            </p>
          </div>

          <div className="scenario-catalog-actions">
            <button type="button" className="secondary-button" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? "Обновляем..." : "Обновить список"}
            </button>
          </div>
        </div>

        {error && (
          <div className="notice-block scenario-catalog-notice">
            <p>{error}</p>
          </div>
        )}

        {isLoading && questionnaires.length === 0 && (
          <div className="scenario-empty-card">
            <p className="page-kicker">Загрузка</p>
            <h2>Получаем сценарии</h2>
            <p>Проверяем опубликованные опросники и готовим список для запуска.</p>
          </div>
        )}

        {!isLoading && questionnaires.length === 0 && (
          <div className="scenario-empty-card">
            <p className="page-kicker">Сценариев пока нет</p>
            <h2>В базе нет опубликованных опросников</h2>
            <p>
              Администратор может загрузить JSON из 1С в серверную часть и опубликовать версию.
              Если нужно проверить сценарий прямо сейчас, используйте ручную загрузку файла.
            </p>

            <div className="scenario-empty-actions">
              <button type="button" className="primary-button" onClick={onOpenManualUpload}>
                Загрузить файл вручную
              </button>
              <button type="button" className="secondary-button" onClick={onRefresh}>
                Проверить ещё раз
              </button>
              <button type="button" className="secondary-button" onClick={onOpenRuns}>
                Мои прохождения
              </button>
              {user.role === "admin" && (
                <button type="button" className="secondary-button" onClick={onOpenAdminUsers}>
                  Пользователи
                </button>
              )}
            </div>
          </div>
        )}

        {questionnaires.length > 0 && (
          <div className="questionnaire-grid">
            {questionnaires.map((questionnaire) => (
              <article key={questionnaire.id} className="questionnaire-card scenario-card">
                <div className="questionnaire-card-header">
                  <div>
                    <h2>{questionnaire.title}</h2>
                    <p>Опубликованная версия сценария готова к запуску оператором.</p>
                  </div>

                  <span className="status-badge status-active">Опубликован</span>
                </div>

                <div className="questionnaire-meta">
                  <span>Код: {questionnaire.id}</span>
                  <span>Версия: {questionnaire.version}</span>
                  <span>Загружен: {formatDateTime(questionnaire.importedAt)}</span>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onSelectQuestionnaire(questionnaire)}
                >
                  Запустить сценарий
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "дата не указана";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
