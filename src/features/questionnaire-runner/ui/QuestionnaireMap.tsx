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
  onNavigateToQuestion: (questionId: string) => void;
}

export function QuestionnaireMap({
  questionnaire,
  currentQuestionId,
  completedRoute,
  onNavigateToQuestion,
}: QuestionnaireMapProps) {
  const completedQuestionIds = new Set(completedRoute);
  const routeQuestionIds = new Set([...completedRoute, currentQuestionId]);
  const groupedQuestions = groupQuestionsBySection(questionnaire);
  const previousQuestionId = completedRoute[completedRoute.length - 1];
  const currentQuestion = questionnaire.questions.find((question) => question.id === currentQuestionId);

  return (
    <div className="runner-navigator">
      <div className="navigator-panel route-panel">
        <div className="route-compact">
          <div>
            <span>Маршрут</span>
            <strong>{completedRoute.length + 1}. {currentQuestion?.title}</strong>
          </div>

          <button
            type="button"
            className="secondary-button route-back-button"
            disabled={!previousQuestionId}
            onClick={() => previousQuestionId && onNavigateToQuestion(previousQuestionId)}
          >
            Назад по маршруту
          </button>
        </div>
      </div>

      <details className="navigator-panel map-card">
        <summary>Схема вопросов</summary>

        <div className="question-map">
          {groupedQuestions.map((group) => (
            <section key={group.sectionTitle} className="question-map-section">
              <h3>{group.sectionTitle}</h3>

              {group.questions.map((question) => {
                const isCurrent = question.id === currentQuestionId;
                const isCompleted = completedQuestionIds.has(question.id);
                const isInRoute = routeQuestionIds.has(question.id);
                const rules = question.rules ?? [];

                return (
                  <div
                    key={question.id}
                    className={[
                      "question-map-item",
                      isCurrent ? "current" : "",
                      isCompleted ? "completed" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      disabled={!isCompleted}
                      onClick={() => onNavigateToQuestion(question.id)}
                    >
                      <span>{isCurrent ? "Сейчас" : isCompleted ? "Пройден" : isInRoute ? "В маршруте" : "Не пройден"}</span>
                      <strong>{question.title}</strong>
                    </button>

                    {rules.length > 0 && (
                      <div className="question-rule-list">
                        {rules.map((rule) => (
                          <small key={`${question.id}-${rule.value}-${rule.action}`}>
                            {rule.value} {"->"} {formatRuleTarget(questionnaire, rule.question_id, rule.action)}
                          </small>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </details>
    </div>
  );
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
