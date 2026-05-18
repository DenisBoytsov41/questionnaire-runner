import type { Questionnaire } from "../entities/questionnaire/types";
import { QuestionnaireRunner } from "../features/questionnaire-runner/ui/QuestionnaireRunner";
import { BrandHeader } from "../shared/ui/BrandHeader";

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
      <BrandHeader
        subtitle="Опросник первой линии"
        action={{
          label: "Загрузить другой JSON",
          onClick: onResetQuestionnaire,
        }}
      />

      <QuestionnaireRunner questionnaire={questionnaire} />
    </main>
  );
}
