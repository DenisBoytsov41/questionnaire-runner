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
      setErrors(["В файле не найден ни один опросник."]);
      return;
    }

    setErrors([]);
    onQuestionnairesLoaded(questionnaires);
  }

  function handleLoadFromText() {
    setErrors([]);

    if (!rawJson.trim()) {
      setErrors(["Вставьте текст файла в поле или выберите файл сценария."]);
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
        setErrors(["В буфере обмена нет текста файла сценария."]);
        return;
      }

      setRawJson(clipboardText);
    } catch {
      setErrors([
        "Страница не получила доступ к буферу обмена. Нажмите на поле ниже и используйте обычное сочетание клавиш для вставки.",
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
      <main className="upload-workspace">
        <div className="upload-card upload-main-card">
          <p className="page-kicker">Загрузка сценария</p>
          <h1>Загрузите файл сценария из 1С</h1>
          <p>
            Выберите файл выгрузки или вставьте его текст вручную. Страница проверит структуру и откроет выбор
            опросника, если в файле несколько сценариев.
          </p>

          <div className="upload-actions-row">
            <label className="file-loader">
              <span>Выбрать файл сценария</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={handlePasteFromClipboard}
            >
              Вставить из буфера обмена
            </button>
          </div>

          <div className="json-paste-panel">
            <div className="json-paste-header">
              <label htmlFor="questionnaire-json">Текст файла сценария</label>
              <span>{rawJson.trim() ? `${rawJson.length} символов` : "Ожидаем файл или вставку"}</span>
            </div>

            <textarea
              id="questionnaire-json"
              className="json-textarea"
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              placeholder='Нажмите сюда и вставьте текст файла, либо используйте кнопку "Вставить из буфера обмена"'
              autoFocus
              spellCheck={false}
            />
          </div>

          {errors.length > 0 && (
            <div className="validation-error">
              <strong>Файл не прошёл проверку:</strong>

              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="primary-button upload-submit-button" onClick={handleLoadFromText}>
            Загрузить из текста
          </button>
        </div>

        <aside className="upload-side">
          <div className="upload-side-card">
            <p className="page-kicker">Что можно загрузить</p>
            <h2>Файлы из 1С</h2>
            <ul className="upload-check-list">
              <li>Один опросник</li>
              <li>Набор из нескольких опросников</li>
              <li>Текст файла из буфера обмена</li>
            </ul>
          </div>

          <div className="upload-side-card">
            <p className="page-kicker">Перед запуском</p>
            <h2>Проверка</h2>
            <p>
              Если структура повреждена, ошибки появятся здесь же. Рабочий сценарий сразу откроется на странице
              оператора.
            </p>
          </div>
        </aside>
      </main>
    </section>
  );
}
