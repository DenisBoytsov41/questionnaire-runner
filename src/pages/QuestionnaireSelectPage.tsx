import type { Questionnaire } from "../entities/questionnaire/types";
import { BrandHeader } from "../shared/ui/BrandHeader";

interface QuestionnaireSelectPageProps {
  questionnaires: Questionnaire[];
  onSelectQuestionnaire: (questionnaire: Questionnaire) => void;
  onReset: () => void;
}

export function QuestionnaireSelectPage({
  questionnaires,
  onSelectQuestionnaire,
  onReset,
}: QuestionnaireSelectPageProps) {
  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Выбор сценария из JSON"
        action={{
          label: "Загрузить другой JSON",
          onClick: onReset,
        }}
      />

      <section className="select-page">
        <div className="select-header">
          <p className="page-kicker">Выбор опросника</p>
          <h1>Выберите сценарий для запуска</h1>
          <p>
            В загруженном JSON найдено несколько опросников. Выберите нужный
            сценарий, после чего откроется форма прохождения.
          </p>
        </div>

        <div className="questionnaire-grid">
          {questionnaires.map((questionnaire) => (
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
                <span>ID: {questionnaire.id}</span>
                <span>Версия схемы: {questionnaire.schema_version}</span>
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
      </section>
    </main>
  );
}
