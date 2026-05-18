import {
  formatAnswerForSummary,
  getActiveQuestions,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  AnswersMap,
  Questionnaire,
  QuestionnaireQuestion,
} from "../../../entities/questionnaire/types";

interface QuestionnaireMapProps {
  questionnaire: Questionnaire;
  currentQuestionId: string;
  completedRoute: string[];
  answers: AnswersMap;
  onNavigateToQuestion: (questionId: string) => void;
}

export function QuestionnaireMap({
  questionnaire,
  currentQuestionId,
  completedRoute,
  answers,
  onNavigateToQuestion,
}: QuestionnaireMapProps) {
  const completedQuestionIds = new Set(completedRoute);
  const routeQuestionIds = new Set([...completedRoute, currentQuestionId]);
  const groupedQuestions = groupQuestionsBySection(questionnaire);

  return (
    <div className="runner-navigator">
      <details className="navigator-panel route-panel">
        <summary>
          <span>Маршрут</span>
          <strong>{completedRoute.length + 1}</strong>
        </summary>

        <div className="runner-sidebar-header">
          <span>Пройденные вопросы и текущий шаг</span>
        </div>

        <div className="route-list">
          {completedRoute.map((questionId, index) => {
            const question = questionnaire.questions.find((item) => item.id === questionId);

            if (!question) {
              return null;
            }

            return (
              <button
                key={`${questionId}-${index}`}
                type="button"
                className="route-step route-step-completed"
                onClick={() => onNavigateToQuestion(questionId)}
              >
                <span>{index + 1}</span>
                <strong>{question.title}</strong>
                <small>{formatAnswerForSummary(question, answers[question.id])}</small>
              </button>
            );
          })}

          <div className="route-step route-step-current">
            <span>{completedRoute.length + 1}</span>
            <strong>
              {questionnaire.questions.find((question) => question.id === currentQuestionId)?.title}
            </strong>
            <small>Текущий вопрос</small>
          </div>
        </div>
      </details>

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
