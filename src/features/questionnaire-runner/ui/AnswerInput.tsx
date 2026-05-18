import { getActiveOptions } from "../../../entities/questionnaire/helpers";
import type {
  QuestionnaireQuestion,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";

interface AnswerInputProps {
  question: QuestionnaireQuestion;
  value: QuestionAnswer;
  onChange: (value: QuestionAnswer) => void;
}

export function AnswerInput({ question, value, onChange }: AnswerInputProps) {
  const options = getActiveOptions(question);

  if (question.answer_type === "boolean") {
    return (
      <div className="answer-buttons">
        <button
          type="button"
          className={value === true ? "answer-button active" : "answer-button"}
          onClick={() => onChange(true)}
        >
          Да
        </button>

        <button
          type="button"
          className={value === false ? "answer-button active" : "answer-button"}
          onClick={() => onChange(false)}
        >
          Нет
        </button>
      </div>
    );
  }

  if (question.answer_type === "select") {
    return (
      <select
        className="field"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
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
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div className="checkbox-list">
        {options.map((option) => {
          const checked = selectedValues.includes(option.value);

          return (
            <label key={option.value} className="checkbox-row">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange([...selectedValues, option.value]);
                  } else {
                    onChange(
                      selectedValues.filter((item) => item !== option.value),
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

  if (question.answer_type === "text") {
    return (
      <textarea
        className="field textarea"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Введите подробный ответ"
      />
    );
  }

  if (question.answer_type === "number") {
    return (
      <input
        className="field"
        type="number"
        value={typeof value === "number" || typeof value === "string" ? value : ""}
        onChange={(event) => {
          const rawValue = event.target.value;
          onChange(rawValue === "" ? null : Number(rawValue));
        }}
        placeholder="Введите число"
      />
    );
  }

  if (question.answer_type === "date") {
    return (
      <input
        className="field"
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="field"
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Введите ответ"
    />
  );
}