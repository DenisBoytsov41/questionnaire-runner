import { useState } from "react";
import type {
  QuestionnaireQuestion,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";
import { AnswerInput } from "./AnswerInput";

interface QuestionCardProps {
  question: QuestionnaireQuestion;
  questionNumber: number;
  totalQuestions: number;
  validationError: string;
  canGoBack: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
  onBack: () => void;
  onFinish: () => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  validationError,
  canGoBack,
  onAnswer,
  onBack,
  onFinish,
}: QuestionCardProps) {
  const [value, setValue] = useState<QuestionAnswer>(null);

  return (
    <article className="question-card">
      <div className="question-meta">
        Вопрос {questionNumber} из {totalQuestions}
      </div>

      <h2>{question.title}</h2>

      {question.hint && <p className="question-hint">{question.hint}</p>}

      {question.required && <div className="required-label">Обязательный вопрос</div>}

      <AnswerInput question={question} value={value} onChange={setValue} />

      {validationError && <div className="validation-error">{validationError}</div>}

      <div className="question-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!canGoBack}
          onClick={onBack}
        >
          Назад
        </button>

        <button type="button" className="secondary-button" onClick={onFinish}>
          Завершить
        </button>

        <button type="button" className="primary-button" onClick={() => onAnswer(value)}>
          Далее
        </button>
      </div>
    </article>
  );
}