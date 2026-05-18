import { useEffect, useState } from "react";
import { getActiveOptions } from "../../../entities/questionnaire/helpers";
import type {
  QuestionnaireQuestion,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";

interface AnswerInputProps {
  question: QuestionnaireQuestion;
  value: QuestionAnswer;
  onChange: (answer: QuestionAnswer) => void;
  onSubmit?: (answer: QuestionAnswer) => void;
}

export function AnswerInput({
  question,
  value,
  onChange,
  onSubmit,
}: AnswerInputProps) {
  const [localValue, setLocalValue] = useState<QuestionAnswer>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [question.id, value]);

  function updateValue(nextValue: QuestionAnswer) {
    setLocalValue(nextValue);
    onChange(nextValue);
  }

  function submitBooleanAnswer(nextValue: boolean) {
    updateValue(nextValue);

    if (onSubmit) {
      onSubmit(nextValue);
    }
  }

  if (question.answer_type === "boolean") {
    return (
      <div className="boolean-answer-group">
        <button
          type="button"
          className={`answer-choice-button ${localValue === true ? "selected" : ""}`}
          onClick={() => submitBooleanAnswer(true)}
        >
          Да
        </button>

        <button
          type="button"
          className={`answer-choice-button ${localValue === false ? "selected" : ""}`}
          onClick={() => submitBooleanAnswer(false)}
        >
          Нет
        </button>
      </div>
    );
  }

  if (question.answer_type === "text") {
    return (
      <textarea
        className="answer-textarea"
        value={typeof localValue === "string" ? localValue : ""}
        placeholder="Введите подробный ответ"
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  }

  if (question.answer_type === "number") {
    return (
      <input
        className="answer-input"
        type="number"
        value={typeof localValue === "number" || typeof localValue === "string" ? localValue : ""}
        placeholder="Введите число"
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  }

  if (question.answer_type === "date") {
    return (
      <input
        className="answer-input"
        type="date"
        value={typeof localValue === "string" ? localValue : ""}
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  }

  if (question.answer_type === "select") {
    const options = getActiveOptions(question);

    return (
      <select
        className="answer-input"
        value={typeof localValue === "string" ? localValue : ""}
        onChange={(event) => updateValue(event.target.value)}
      >
        <option value="">Выберите вариант</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </select>
    );
  }

  if (question.answer_type === "multiselect") {
    const options = getActiveOptions(question);
    const selectedValues = Array.isArray(localValue) ? localValue : [];

    return (
      <div className="checkbox-answer-group">
        {options.map((option) => {
          const checked = selectedValues.includes(option.value);

          return (
            <label key={option.value} className="checkbox-answer-item">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  if (event.target.checked) {
                    updateValue([...selectedValues, option.value]);
                  } else {
                    updateValue(
                      selectedValues.filter((valueItem) => valueItem !== option.value),
                    );
                  }
                }}
              />
              <span>{option.title}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <input
      className="answer-input"
      type="text"
      value={typeof localValue === "string" ? localValue : ""}
      placeholder="Введите ответ"
      onChange={(event) => updateValue(event.target.value)}
    />
  );
}