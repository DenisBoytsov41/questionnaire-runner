import {
  getActiveQuestions,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  Questionnaire,
  QuestionnaireQuestion,
} from "../../../entities/questionnaire/types";

interface QuestionnaireMapProps {
  questionnaire: Questionnaire;
  currentQuestionId: string;
  completedRoute: string[];
  totalQuestions: number;
  answeredCount: number;
  startedAt: string;
  draftSavedAt: string;
  onBack: () => void;
  onClearDraft: () => void;
  onNavigateToQuestion: (questionId: string) => void;
}

export function QuestionnaireMap({
  questionnaire,
  currentQuestionId,
  completedRoute,
  totalQuestions,
  answeredCount,
  startedAt,
  draftSavedAt,
  onBack,
  onClearDraft,
  onNavigateToQuestion,
}: QuestionnaireMapProps) {
  const completedQuestionIds = new Set(completedRoute);
  const routeQuestionIds = new Set([...completedRoute, currentQuestionId]);
  const groupedQuestions = groupQuestionsBySection(questionnaire);
  const currentQuestion = questionnaire.questions.find((question) => question.id === currentQuestionId);
  const currentStep = Math.min(completedRoute.length + 1, totalQuestions);
  const progressValue = totalQuestions > 0 ? Math.round((currentStep / totalQuestions) * 100) : 0;

  return (
    <div className="runner-navigator">
      <section className="navigator-panel route-panel" aria-label="Маршрут прохождения">
        <div className="route-card-header">
          <div>
            <span className="panel-kicker">Маршрут</span>
            <strong>{currentStep} из {totalQuestions}</strong>
          </div>
          <span className="route-progress-percent">{progressValue}%</span>
        </div>

        <div className="route-progress-track" aria-hidden="true">
          <span style={{ width: `${progressValue}%` }} />
        </div>

        <p className="route-current-question">{currentQuestion?.title}</p>

        <button
          type="button"
          className="secondary-button route-back-button"
          disabled={completedRoute.length === 0}
          onClick={onBack}
        >
          Назад к предыдущему вопросу
        </button>
      </section>

      <section className="navigator-panel draft-status-card" aria-label="Состояние черновика">
        <div>
          <span className="panel-kicker">Состояние</span>
          <strong>{draftSavedAt ? "Черновик сохранён" : "Новый опрос"}</strong>
        </div>

        <dl className="draft-status-grid">
          <div>
            <dt>Начало</dt>
            <dd>{formatTime(startedAt)}</dd>
          </div>
          <div>
            <dt>Сохранено</dt>
            <dd>{draftSavedAt ? formatTime(draftSavedAt) : "пока нет"}</dd>
          </div>
          <div>
            <dt>Ответов</dt>
            <dd>{answeredCount}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="secondary-button draft-clear-button"
          disabled={!draftSavedAt && answeredCount === 0}
          onClick={onClearDraft}
        >
          Очистить и начать заново
        </button>
      </section>

      <details className="navigator-panel map-card">
        <summary>Схема вопросов</summary>

        <div className="question-map" id="question-map">
          {groupedQuestions.map((group) => (
            <section key={group.sectionTitle} className="question-map-section">
              <h3>{group.sectionTitle}</h3>

              {group.questions.map((question) => {
                const isCurrent = question.id === currentQuestionId;
                const isCompleted = completedQuestionIds.has(question.id);
                const isInRoute = routeQuestionIds.has(question.id);
                const rules = question.rules ?? [];

                return (
                  <article
                    key={question.id}
                    className={[
                      "question-map-item",
                      isCurrent ? "current" : "",
                      isCompleted ? "completed" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      disabled={!isCompleted || isCurrent}
                      onClick={() => onNavigateToQuestion(question.id)}
                    >
                      <span>{isCurrent ? "Сейчас" : isCompleted ? "Пройден" : isInRoute ? "В маршруте" : "Не пройден"}</span>
                      <strong>{question.title}</strong>
                    </button>

                    {rules.length > 0 && (
                      <div className="question-rule-list">
                        {rules.map((rule) => (
                          <small key={`${question.id}-${rule.value}-${rule.action}`}>
                            {formatRuleValue(rule.value)} {"->"} {formatRuleTarget(questionnaire, rule.question_id, rule.action)}
                          </small>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface QuestionGroup {
  sectionTitle: string;
  questions: QuestionnaireQuestion[];
}

function groupQuestionsBySection(questionnaire: Questionnaire): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();

  getActiveQuestions(questionnaire).forEach((question) => {
    const section = getSectionById(questionnaire, question.section_id);
    const sectionTitle = section?.title ?? "Без раздела";
    const group = groups.get(sectionTitle) ?? {
      sectionTitle,
      questions: [],
    };

    group.questions.push(question);
    groups.set(sectionTitle, group);
  });

  return Array.from(groups.values());
}

function formatRuleValue(value: string | boolean | number | null): string {
  if (value === true || value === "true") {
    return "Да";
  }

  if (value === false || value === "false") {
    return "Нет";
  }

  return value === null ? "Любой ответ" : String(value);
}

function formatRuleTarget(
  questionnaire: Questionnaire,
  questionId: string | null,
  action: string,
): string {
  if (action === "finish") {
    return "завершить";
  }

  if (action === "next") {
    return "следующий";
  }

  const question = questionId
    ? questionnaire.questions.find((item) => item.id === questionId)
    : null;

  return question?.title ?? questionId ?? "не задан";
}
