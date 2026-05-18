import { useEffect, useState } from "react";
import type { Questionnaire } from "./entities/questionnaire/types";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { QuestionnaireSelectPage } from "./pages/QuestionnaireSelectPage";
import { loadQuestionnaireFromPublic } from "./shared/api/questionnaireApi";
import "./App.css";

function App() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] =
    useState<Questionnaire | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadQuestionnaireFromPublic("Чек-лист звонка по ККТ.json").then((result) => {
      if (result.ok) {
        setQuestionnaires(result.questionnaires);
        setLoadError("");

        if (result.questionnaires.length === 1) {
          setSelectedQuestionnaire(result.questionnaires[0]);
        }

        return;
      }

      setLoadError(
        [
          "Тестовый файл public/questionnaires/Чек-лист звонка по ККТ.json не найден или содержит ошибки.",
          "Можно загрузить JSON вручную.",
          ...result.errors,
        ].join("\n"),
      );
    });
  }, []);

  function handleQuestionnairesLoaded(loadedQuestionnaires: Questionnaire[]) {
    setQuestionnaires(loadedQuestionnaires);
    setLoadError("");

    if (loadedQuestionnaires.length === 1) {
      setSelectedQuestionnaire(loadedQuestionnaires[0]);
      return;
    }

    setSelectedQuestionnaire(null);
  }

  function handleResetAll() {
    setQuestionnaires([]);
    setSelectedQuestionnaire(null);
    setLoadError("");
  }

  if (selectedQuestionnaire) {
    return (
      <QuestionnaireRunPage
        questionnaire={selectedQuestionnaire}
        onResetQuestionnaire={() => setSelectedQuestionnaire(null)}
      />
    );
  }

  if (questionnaires.length > 1) {
    return (
      <QuestionnaireSelectPage
        questionnaires={questionnaires}
        onSelectQuestionnaire={setSelectedQuestionnaire}
        onReset={handleResetAll}
      />
    );
  }

  return (
    <main className="app-shell">
      {loadError && (
        <div className="notice-block">
          {loadError.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <JsonUploadPage onQuestionnairesLoaded={handleQuestionnairesLoaded} />
    </main>
  );
}

export default App;
