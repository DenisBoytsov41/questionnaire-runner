import type { Questionnaire } from "../entities/questionnaire/types";
import type { CurrentUser, UserPreferences } from "../shared/api/backendApi";
import { QuestionnaireRunner } from "../features/questionnaire-runner/ui/QuestionnaireRunner";
import { BrandHeader, type SettingsStatus } from "../shared/ui/BrandHeader";

interface QuestionnaireRunPageProps {
  questionnaire: Questionnaire;
  onResetQuestionnaire: () => void;
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function QuestionnaireRunPage({
  questionnaire,
  onResetQuestionnaire,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
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
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <QuestionnaireRunner questionnaire={questionnaire} />
    </main>
  );
}
