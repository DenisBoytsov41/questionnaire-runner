import type { Questionnaire } from "../entities/questionnaire/types";
import {
  QuestionnaireRunner,
  type QuestionnaireRunPersistence,
} from "../features/questionnaire-runner/ui/QuestionnaireRunner";
import type { CurrentUser, UserPreferences } from "../shared/api/backendApi";
import { BrandHeader, type SettingsStatus } from "../shared/ui/BrandHeader";

interface QuestionnaireRunPageProps {
  questionnaire: Questionnaire;
  onResetQuestionnaire: () => void;
  resetLabel?: string;
  backendRun?: QuestionnaireRunPersistence;
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
  resetLabel = "Выбрать другой сценарий",
  backendRun,
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
          label: resetLabel,
          onClick: onResetQuestionnaire,
        }}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <QuestionnaireRunner questionnaire={questionnaire} backendRun={backendRun} />
    </main>
  );
}
