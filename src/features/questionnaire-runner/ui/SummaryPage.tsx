import {
  formatAnswerForSummary,
  getActiveQuestions,
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
  onRestart: () => void;
}

export function SummaryPage({
  questionnaire,
  answers,
  messages,
  verdicts,
  onRestart,
}: SummaryPageProps) {
  const answeredQuestions = getActiveQuestions(questionnaire).filter(
    (question) => question.show_in_summary && question.id in answers,
  );

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

      <button type="button" className="primary-button" onClick={onRestart}>
        Пройти заново
      </button>
    </section>
  );
}