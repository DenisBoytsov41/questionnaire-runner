import { useState } from "react";
import type { Questionnaire } from "../entities/questionnaire/types";
import { parseQuestionnaireJson } from "../shared/api/questionnaireApi";

interface JsonUploadPageProps {
  onQuestionnaireLoaded: (questionnaire: Questionnaire) => void;
}

export function JsonUploadPage({ onQuestionnaireLoaded }: JsonUploadPageProps) {
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState("");

  function handleLoadFromText() {
    setError("");

    try {
      const questionnaire = parseQuestionnaireJson(rawJson);
      onQuestionnaireLoaded(questionnaire);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось прочитать JSON.";

      setError(message);
    }
  }

  function handleFileChange(file: File | null) {
    setError("");

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result ?? "");

      try {
        const questionnaire = parseQuestionnaireJson(text);
        onQuestionnaireLoaded(questionnaire);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Не удалось прочитать JSON.";

        setError(message);
      }
    };

    reader.onerror = () => {
      setError("Не удалось прочитать файл.");
    };

    reader.readAsText(file, "UTF-8");
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

        {error && <div className="validation-error">{error}</div>}

        <button type="button" className="primary-button" onClick={handleLoadFromText}>
          Загрузить из текста
        </button>
      </div>
    </section>
  );
}