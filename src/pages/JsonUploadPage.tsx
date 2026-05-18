import { useState } from "react";
import type { Questionnaire } from "../entities/questionnaire/types";
import {
  parseQuestionnaireJsonText,
  readJsonFile,
} from "../shared/api/questionnaireApi";

interface JsonUploadPageProps {
  onQuestionnairesLoaded: (questionnaires: Questionnaire[]) => void;
}

export function JsonUploadPage({ onQuestionnairesLoaded }: JsonUploadPageProps) {
  const [rawJson, setRawJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function loadQuestionnaires(questionnaires: Questionnaire[]) {
    if (questionnaires.length === 0) {
      setErrors(["В JSON не найден ни один опросник."]);
      return;
    }

    setErrors([]);
    onQuestionnairesLoaded(questionnaires);
  }

  function handleLoadFromText() {
    setErrors([]);

    if (!rawJson.trim()) {
      setErrors(["Вставьте JSON опросника в поле или выберите JSON-файл."]);
      return;
    }

    const result = parseQuestionnaireJsonText(rawJson);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    loadQuestionnaires(result.questionnaires);
  }

  async function handlePasteFromClipboard() {
    setErrors([]);

    try {
      const clipboardText = await navigator.clipboard.readText();

      if (!clipboardText.trim()) {
        setErrors(["В буфере обмена нет текста с JSON."]);
        return;
      }

      setRawJson(clipboardText);
    } catch {
      setErrors([
        "Браузер не дал доступ к буферу обмена. Кликните в поле ниже и нажмите Ctrl+V.",
      ]);
    }
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

    loadQuestionnaires(result.questionnaires);
  }

  return (
    <section className="upload-page">
      <div className="upload-card">
        <p className="page-kicker">Загрузка сценария</p>
        <h1>Загрузите JSON опросника из 1С</h1>
        <p>
          Можно выбрать один JSON-опросник, bundle-файл с несколькими
          опросниками или вставить содержимое JSON вручную.
        </p>

        <label className="file-loader">
          <span>Выбрать JSON-файл</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="json-paste-panel">
          <div className="json-paste-header">
            <label htmlFor="questionnaire-json">JSON опросника</label>

            <button
              type="button"
              className="secondary-button"
              onClick={handlePasteFromClipboard}
            >
              Вставить из буфера
            </button>
          </div>

          <textarea
            id="questionnaire-json"
            className="json-textarea"
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
            placeholder='Кликните сюда и нажмите Ctrl+V, либо используйте кнопку "Вставить из буфера"'
            autoFocus
            spellCheck={false}
          />
        </div>

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
