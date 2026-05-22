import type { Questionnaire } from "../entities/questionnaire/types";
import {
  QuestionnaireRunner,
  type QuestionnaireRunPersistence,
} from "../features/questionnaire-runner/ui/QuestionnaireRunner";
import type { CurrentUser, UserPreferences } from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";

interface QuestionnaireRunPageProps {
  questionnaire: Questionnaire;
  backendRun?: QuestionnaireRunPersistence;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function QuestionnaireRunPage({
  questionnaire,
  backendRun,
  navigationItems,
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
        navigationItems={navigationItems}
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
