import type { Questionnaire } from "../entities/questionnaire/types";
import type { CurrentUser, UserPreferences } from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";
import { Pagination } from "../shared/ui/Pagination";
import { usePagination } from "../shared/ui/usePagination";

interface QuestionnaireSelectPageProps {
  questionnaires: Questionnaire[];
  onSelectQuestionnaire: (questionnaire: Questionnaire) => void;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function QuestionnaireSelectPage({
  questionnaires,
  onSelectQuestionnaire,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: QuestionnaireSelectPageProps) {
  const questionnairesPagination = usePagination(questionnaires, {
    defaultPageSize: 5,
    resetKey: String(questionnaires.length),
  });

  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Выбор сценария из файла"
        navigationItems={navigationItems}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <section className="select-page">
        <div className="select-header">
          <p className="page-kicker">Выбор опросника</p>
          <h1>Выберите сценарий для запуска</h1>
          <p>
            В загруженном файле найдено несколько опросников. Выберите нужный сценарий, после чего
            откроется форма прохождения.
          </p>
        </div>

        <div className="questionnaire-grid">
          {questionnairesPagination.pageItems.map((questionnaire) => (
            <article key={questionnaire.id} className="questionnaire-card">
              <div className="questionnaire-card-header">
                <div>
                  <h2>{questionnaire.title}</h2>
                  <p>{questionnaire.description || "Описание не заполнено."}</p>
                </div>

                <span
                  className={
                    questionnaire.active
                      ? "status-badge status-active"
                      : "status-badge status-inactive"
                  }
                >
                  {questionnaire.active ? "Активен" : "Не активен"}
                </span>
              </div>

              <div className="questionnaire-meta">
                <span>Код: {questionnaire.id}</span>
                <span>Версия формата: {questionnaire.schema_version}</span>
                <span>Разделов: {questionnaire.sections.length}</span>
                <span>Вопросов: {questionnaire.questions.length}</span>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => onSelectQuestionnaire(questionnaire)}
              >
                Запустить опросник
              </button>
            </article>
          ))}
        </div>
        <Pagination
          label="сценариев"
          page={questionnairesPagination.page}
          pageSize={questionnairesPagination.pageSize}
          totalItems={questionnairesPagination.totalItems}
          totalPages={questionnairesPagination.totalPages}
          onPageChange={questionnairesPagination.setPage}
          onPageSizeChange={questionnairesPagination.setPageSize}
        />
      </section>
    </main>
  );
}
