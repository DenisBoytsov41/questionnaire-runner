import {
  formatAnswerForSummary,
  getQuestionById,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  AnswersMap,
  Questionnaire,
} from "../../../entities/questionnaire/types";

interface SummaryPageProps {
  questionnaire: Questionnaire;
  answers: AnswersMap;
  messages: string[];
  verdicts: string[];
  route: string[];
  startedAt: string;
  finishedAt: string | null;
  onRestart: () => void;
}

export function SummaryPage({
  questionnaire,
  answers,
  messages,
  verdicts,
  route,
  startedAt,
  finishedAt,
  onRestart,
}: SummaryPageProps) {
  const answeredQuestions = route
    .map((questionId) => getQuestionById(questionnaire, questionId))
    .filter((question): question is AnsweredQuestion => {
      return Boolean(
        question &&
          question.show_in_summary &&
          Object.prototype.hasOwnProperty.call(answers, question.id),
      );
    });
  const result = buildQuestionnaireResult({
    questionnaire,
    answers,
    messages,
    verdicts,
    route,
    startedAt,
    finishedAt,
  });
  const summaryText = buildSummaryText(questionnaire, answeredQuestions, answers, messages, verdicts);

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText);
  }

  function downloadResultJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${questionnaire.id}-result.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="summary-page">
      <div className="summary-header">
        <p className="page-kicker">Опрос завершён</p>
        <h1>{questionnaire.title}</h1>
        <p>{questionnaire.finish_text}</p>
      </div>

      {messages.length > 0 && (
        <div className="notice-block">
          <h2>Сообщения по сценарию</h2>
          {messages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      )}

      {verdicts.length > 0 && (
        <div className="verdict-block">
          <h2>Вердикты</h2>
          {verdicts.map((verdict, index) => (
            <p key={`${verdict}-${index}`}>{verdict}</p>
          ))}
        </div>
      )}

      <div className="summary-list">
        <h2>Итоговые ответы</h2>

        {answeredQuestions.length === 0 && (
          <p className="muted">Нет ответов, отмеченных для отображения в итоге.</p>
        )}

        {answeredQuestions.map((question) => {
          const section = getSectionById(questionnaire, question.section_id);

          return (
            <div key={question.id} className="summary-item">
              <div className="summary-section">{section?.title ?? "Без раздела"}</div>
              <div className="summary-question">{question.title}</div>
              <div className="summary-answer">
                {formatAnswerForSummary(question, answers[question.id])}
              </div>
            </div>
          );
        })}
      </div>

      <div className="summary-actions">
        <button type="button" className="primary-button" onClick={copySummary}>
          Скопировать итог
        </button>

        <button type="button" className="secondary-button" onClick={downloadResultJson}>
          Скачать результат JSON
        </button>

        <button type="button" className="secondary-button" onClick={onRestart}>
          Пройти заново
        </button>
      </div>
    </section>
  );
}

type AnsweredQuestion = NonNullable<ReturnType<typeof getQuestionById>>;

interface BuildQuestionnaireResultParams {
  questionnaire: Questionnaire;
  answers: AnswersMap;
  messages: string[];
  verdicts: string[];
  route: string[];
  startedAt: string;
  finishedAt: string | null;
}

function buildQuestionnaireResult({
  questionnaire,
  answers,
  messages,
  verdicts,
  route,
  startedAt,
  finishedAt,
}: BuildQuestionnaireResultParams) {
  return {
    schema: "first_line_questionnaire_result",
    schema_version: 1,
    questionnaire_id: questionnaire.id,
    questionnaire_title: questionnaire.title,
    started_at: startedAt,
    finished_at: finishedAt ?? new Date().toISOString(),
    route,
    answers: route
      .map((questionId) => getQuestionById(questionnaire, questionId))
      .filter((question): question is AnsweredQuestion => {
        return Boolean(question && Object.prototype.hasOwnProperty.call(answers, question.id));
      })
      .map((question) => ({
        question_id: question.id,
        question_title: question.title,
        section_id: question.section_id,
        value: answers[question.id],
        display_value: formatAnswerForSummary(question, answers[question.id]),
      })),
    messages,
    verdicts,
  };
}

function buildSummaryText(
  questionnaire: Questionnaire,
  answeredQuestions: AnsweredQuestion[],
  answers: AnswersMap,
  messages: string[],
  verdicts: string[],
): string {
  const lines = [`Итог опросника: ${questionnaire.title}`, ""];

  if (messages.length > 0) {
    lines.push("Сообщения:");
    messages.forEach((message) => lines.push(`- ${message}`));
    lines.push("");
  }

  if (verdicts.length > 0) {
    lines.push("Вердикты:");
    verdicts.forEach((verdict) => lines.push(`- ${verdict}`));
    lines.push("");
  }

  lines.push("Ответы:");
  answeredQuestions.forEach((question) => {
    lines.push(`${question.title}: ${formatAnswerForSummary(question, answers[question.id])}`);
  });

  return lines.join("\n");
}
