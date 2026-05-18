import { useCallback, useEffect, useState } from "react";
import { isAnswerEmpty } from "../../../entities/questionnaire/helpers";
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

function getDefaultAnswer(question: QuestionnaireQuestion): QuestionAnswer {
  if (question.answer_type === "boolean") {
    return null;
  }

  if (question.answer_type === "multiselect") {
    return [];
  }

  return "";
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
  const [answer, setAnswer] = useState<QuestionAnswer>(() => getDefaultAnswer(question));

  const submitAnswer = useCallback((nextAnswer: QuestionAnswer = answer) => {
    if (question.required && isAnswerEmpty(nextAnswer)) {
      return;
    }

    onAnswer(nextAnswer);
  }, [answer, onAnswer, question]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();

      const isTextArea = tagName === "textarea";
      const isInput = tagName === "input";
      const isSelect = tagName === "select";

      if (event.key === "Escape" && canGoBack) {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      if (isTextArea && !event.ctrlKey) {
        return;
      }

      if ((isInput || isSelect || isTextArea) && event.shiftKey) {
        return;
      }

      event.preventDefault();
      submitAnswer();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canGoBack, onBack, submitAnswer]);

  const isBooleanQuestion = question.answer_type === "boolean";

  return (
    <article className="question-card">
      <div className="question-meta">
        Вопрос {questionNumber} из {totalQuestions}
      </div>

      <h2>{question.title}</h2>

      {question.hint && <div className="question-hint">{question.hint}</div>}

      <AnswerInput
        question={question}
        value={answer}
        onChange={setAnswer}
        onSubmit={submitAnswer}
      />

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

        {!isBooleanQuestion && (
          <button type="button" className="primary-button" onClick={() => submitAnswer()}>
            Далее
          </button>
        )}
      </div>

      <div className="keyboard-hint">
        {isBooleanQuestion
          ? "Выберите Да или Нет — переход выполнится автоматически."
          : "Enter — далее, Ctrl + Enter — далее из многострочного поля, Esc — назад."}
      </div>
    </article>
  );
}
