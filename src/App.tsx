import { useEffect, useState } from "react";
import type { Questionnaire } from "./entities/questionnaire/types";
import { JsonUploadPage } from "./pages/JsonUploadPage";
import { QuestionnaireRunPage } from "./pages/QuestionnaireRunPage";
import { loadQuestionnaireFromPublic } from "./shared/api/questionnaireApi";
import "./App.css";

function App() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadQuestionnaireFromPublic("kkt-checklist.json").then((result) => {
      if (result.ok) {
        const firstQuestionnaire = result.questionnaires[0];

        if (firstQuestionnaire) {
          setQuestionnaire(firstQuestionnaire);
          setLoadError("");
          return;
        }

        setLoadError("В JSON-файле не найден ни один опросник.");
        return;
      }

      setLoadError(
        [
          "Тестовый файл public/questionnaires/kkt-checklist.json не найден или содержит ошибки.",
          "Можно загрузить JSON вручную.",
          ...result.errors,
        ].join("\n"),
      );
    });
  }, []);

  if (!questionnaire) {
    return (
      <main className="app-shell">
        {loadError && (
          <div className="notice-block">
            {loadError.split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

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