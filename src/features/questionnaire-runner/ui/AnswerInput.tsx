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
  function updateValue(nextValue: QuestionAnswer) {
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
          className={`answer-choice-button ${value === true ? "selected" : ""}`}
          onClick={() => submitBooleanAnswer(true)}
        >
          <span>Да</span>
        </button>

        <button
          type="button"
          className={`answer-choice-button ${value === false ? "selected" : ""}`}
          onClick={() => submitBooleanAnswer(false)}
        >
          <span>Нет</span>
        </button>
      </div>
    );
  }

  if (question.answer_type === "text") {
    return (
      <textarea
        className="answer-textarea"
        value={typeof value === "string" ? value : ""}
        placeholder="Введите подробный ответ"
        onChange={(event) => updateValue(event.target.value)}
        autoFocus
      />
    );
  }

  if (question.answer_type === "number") {
    return (
      <input
        className="answer-input"
        type="number"
        value={typeof value === "number" || typeof value === "string" ? value : ""}
        placeholder="Введите число"
        onChange={(event) => updateValue(event.target.value)}
        autoFocus
      />
    );
  }

  if (question.answer_type === "date") {
    return (
      <input
        className="answer-input"
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => updateValue(event.target.value)}
        autoFocus
      />
    );
  }

  if (question.answer_type === "select") {
    const options = getActiveOptions(question);

    return (
      <select
        className="answer-input"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => updateValue(event.target.value)}
        autoFocus
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
    const selectedValues = Array.isArray(value) ? value : [];

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
      value={typeof value === "string" ? value : ""}
      placeholder="Введите ответ"
      onChange={(event) => updateValue(event.target.value)}
      autoFocus
    />
  );
}
