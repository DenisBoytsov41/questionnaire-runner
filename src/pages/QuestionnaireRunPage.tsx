import type { Questionnaire } from "../entities/questionnaire/types";
import { QuestionnaireRunner } from "../features/questionnaire-runner/ui/QuestionnaireRunner";

interface QuestionnaireRunPageProps {
  questionnaire: Questionnaire;
  onResetQuestionnaire: () => void;
}

export function QuestionnaireRunPage({
  questionnaire,
  onResetQuestionnaire,
}: QuestionnaireRunPageProps) {
  return (
    <main className="app-shell">
      <div className="top-bar">
        <div>
          <strong>Questionnaire Runner</strong>
          <span>JSON из 1С</span>
        </div>

        <button type="button" className="secondary-button" onClick={onResetQuestionnaire}>
          Загрузить другой JSON
        </button>
      </div>

      <QuestionnaireRunner questionnaire={questionnaire} />
    </main>
  );
}