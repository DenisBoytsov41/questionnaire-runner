import { useState } from "react";
import type { Questionnaire } from "../entities/questionnaire/types";
import {
  parseQuestionnaireJsonText,
  readJsonFile,
} from "../shared/api/questionnaireApi";

interface JsonUploadPageProps {
  onQuestionnaireLoaded: (questionnaire: Questionnaire) => void;
}

export function JsonUploadPage({ onQuestionnaireLoaded }: JsonUploadPageProps) {
  const [rawJson, setRawJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function loadFirstQuestionnaire(questionnaires: Questionnaire[]) {
    const firstQuestionnaire = questionnaires[0];

    if (!firstQuestionnaire) {
      setErrors(["В JSON не найден ни один опросник."]);
      return;
    }

    setErrors([]);
    onQuestionnaireLoaded(firstQuestionnaire);
  }

  function handleLoadFromText() {
    setErrors([]);

    const result = parseQuestionnaireJsonText(rawJson);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    loadFirstQuestionnaire(result.questionnaires);
  }

  async function handleFileChange(file: File | null) {
    setErrors([]);

    if (!file) {
      return;
    }

    const result = await readJsonFile(file);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    loadFirstQuestionnaire(result.questionnaires);
  }

  return (
    <section className="upload-page">
      <div className="upload-card">
        <p className="page-kicker">Загрузка сценария</p>
        <h1>Загрузите JSON опросника из 1С</h1>
        <p>
          Можно выбрать файл .json, который выгружен из конструктора опросников,
          или вставить содержимое JSON вручную.
        </p>

        <label className="file-loader">
          <span>Выбрать JSON-файл</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        <textarea
          className="json-textarea"
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          placeholder="Вставьте JSON опросника сюда"
        />

        {errors.length > 0 && (
          <div className="validation-error">
            <strong>JSON не прошёл проверку:</strong>

            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="primary-button" onClick={handleLoadFromText}>
          Загрузить из текста
        </button>
      </div>
    </section>
  );
}