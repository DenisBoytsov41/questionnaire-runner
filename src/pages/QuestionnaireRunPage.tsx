import type { Questionnaire } from "../entities/questionnaire/types";
import type { CurrentUser } from "../shared/api/backendApi";
import { QuestionnaireRunner } from "../features/questionnaire-runner/ui/QuestionnaireRunner";
import { BrandHeader } from "../shared/ui/BrandHeader";

interface QuestionnaireRunPageProps {
  questionnaire: Questionnaire;
  onResetQuestionnaire: () => void;
  user: CurrentUser;
  onLogout: () => void;
}

export function QuestionnaireRunPage({
  questionnaire,
  onResetQuestionnaire,
  user,
  onLogout,
}: QuestionnaireRunPageProps) {
  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Опросник первой линии"
        action={{
          label: "Загрузить другой файл",
          onClick: onResetQuestionnaire,
        }}
        user={user}
        onLogout={onLogout}
      />

      <QuestionnaireRunner questionnaire={questionnaire} />
    </main>
  );
}
