import { useEffect, useState } from "react";
import type { Questionnaire } from "./entities/questionnaire/types";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { loadQuestionnaireFromPublicFile } from "./shared/api/questionnaireApi";
import "./App.css";

function App() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadQuestionnaireFromPublicFile("kkt-checklist.json")
      .then((loadedQuestionnaire) => {
        setQuestionnaire(loadedQuestionnaire);
      })
      .catch(() => {
        setLoadError(
          "Тестовый файл public/questionnaires/kkt-checklist.json не найден. Можно загрузить JSON вручную.",
        );
      });
  }, []);

  if (!questionnaire) {
    return (
      <main className="app-shell">
        {loadError && <div className="notice-block">{loadError}</div>}

        <JsonUploadPage onQuestionnaireLoaded={setQuestionnaire} />
      </main>
    );
  }

  return (
    <QuestionnaireRunPage
      questionnaire={questionnaire}
      onResetQuestionnaire={() => setQuestionnaire(null)}
    />
  );
}

export default App;