import { useState } from "react";
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
  const [copyStatus, setCopyStatus] = useState("");
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
  const groupedQuestions = groupQuestionsBySection(questionnaire, answeredQuestions);
  const applicationFields = getApplicationFields(answeredQuestions, answers);
  const summaryText = buildSummaryText(questionnaire, groupedQuestions, answers, messages, verdicts);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus("Итог скопирован в буфер обмена.");
    } catch {
      setCopyStatus("Браузер не дал доступ к буферу. Выделите итог и скопируйте вручную.");
    }
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
        <div>
          <p className="page-kicker">Опрос завершён</p>
          <h1>{questionnaire.title}</h1>
          <p>{questionnaire.finish_text}</p>
        </div>

        <div className="summary-score-card">
          <strong>{answeredQuestions.length}</strong>
          <span>ответов в итоге</span>
        </div>
      </div>

      <div className="summary-layout">
        <div className="summary-main">
          <div className="summary-panel application-panel">
            <div className="summary-panel-header">
              <p className="page-kicker">Для заявки</p>
              <h2>Краткий итог оператору</h2>
            </div>

            {applicationFields.length === 0 ? (
              <p className="muted">Ключевые поля заявки пока не найдены в ответах.</p>
            ) : (
              <dl className="application-grid">
                {applicationFields.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {(messages.length > 0 || verdicts.length > 0) && (
            <div className="summary-alert-grid">
              {messages.length > 0 && (
                <div className="notice-block">
                  <h2>Сообщения</h2>
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
            </div>
          )}

          <div className="summary-list">
            <h2>Ответы по маршруту</h2>

            {answeredQuestions.length === 0 && (
              <p className="muted">Нет ответов, отмеченных для отображения в итоге.</p>
            )}

            {groupedQuestions.map((group) => (
              <section key={group.sectionTitle} className="summary-section-card">
                <h3>{group.sectionTitle}</h3>

                {group.questions.map((question) => (
                  <div key={question.id} className="summary-item">
                    <div className="summary-question">{question.title}</div>
                    <div className="summary-answer">
                      {formatAnswerForSummary(question, answers[question.id])}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>

        <aside className="summary-side">
          <div className="summary-panel">
            <h2>Действия</h2>

            <div className="summary-actions">
              <button type="button" className="primary-button" onClick={copySummary}>
                Скопировать итог
              </button>

              <button type="button" className="secondary-button" onClick={downloadResultJson}>
                Скачать JSON
              </button>

              <button type="button" className="secondary-button" onClick={onRestart}>
                Пройти заново
              </button>
            </div>

            {copyStatus && <p className="copy-status">{copyStatus}</p>}
          </div>

          <div className="summary-panel">
            <h2>Служебно</h2>
            <p className="summary-technical">Маршрут: {route.length} шагов</p>
            <p className="summary-technical">Старт: {formatDateTime(startedAt)}</p>
            <p className="summary-technical">
              Финиш: {formatDateTime(finishedAt ?? new Date().toISOString())}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

type AnsweredQuestion = NonNullable<ReturnType<typeof getQuestionById>>;

interface SummaryQuestionGroup {
  sectionTitle: string;
  questions: AnsweredQuestion[];
}

interface ApplicationField {
  label: string;
  value: string;
}

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
  groupedQuestions: SummaryQuestionGroup[],
  answers: AnswersMap,
  messages: string[],
  verdicts: string[],
): string {
  const lines = [`Итог для заявки: ${questionnaire.title}`, ""];

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

  lines.push("Ответы по разделам:");
  groupedQuestions.forEach((group) => {
    lines.push("");
    lines.push(group.sectionTitle);
    group.questions.forEach((question) => {
      lines.push(`- ${question.title}: ${formatAnswerForSummary(question, answers[question.id])}`);
    });
  });

  return lines.join("\n");
}

function groupQuestionsBySection(
  questionnaire: Questionnaire,
  questions: AnsweredQuestion[],
): SummaryQuestionGroup[] {
  const groups = new Map<string, SummaryQuestionGroup>();

  questions.forEach((question) => {
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

function getApplicationFields(
  questions: AnsweredQuestion[],
  answers: AnswersMap,
): ApplicationField[] {
  const fieldMatchers: Array<[string, RegExp]> = [
    ["Клиент", /фио клиента|имя клиента/i],
    ["Телефон", /телефон/i],
    ["Организация", /организац/i],
    ["ККТ", /модель ккт/i],
    ["Серийный номер", /серийный номер/i],
    ["ФН", /фискальный номер|номер фн/i],
    ["Суть обращения", /суть обращения/i],
  ];

  return fieldMatchers
    .map(([label, matcher]) => {
      const question = questions.find((item) => matcher.test(item.title));

      if (!question) {
        return null;
      }

      return {
        label,
        value: formatAnswerForSummary(question, answers[question.id]),
      };
    })
    .filter((field): field is ApplicationField => Boolean(field));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
