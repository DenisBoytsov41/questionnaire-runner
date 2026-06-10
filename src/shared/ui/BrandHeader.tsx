import { useEffect, useRef, useState } from "react";
import { defaultUserPreferences, type CurrentUser, type UserPreferences } from "../api/backendApi";

export type SettingsStatus = "idle" | "saving" | "saved" | "error";

export type HeaderNavigationItem = {
  label: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
};

interface BrandHeaderProps {
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  navigationItems?: HeaderNavigationItem[];
  user?: CurrentUser;
  settings: UserPreferences;
  settingsStatus?: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

const textSizeOptions: Array<{ value: UserPreferences["textSize"]; label: string }> = [
  { value: "normal", label: "Обычный" },
  { value: "large", label: "Крупнее" },
  { value: "xlarge", label: "Очень крупный" },
];

const themeOptions: Array<{ value: UserPreferences["theme"]; label: string }> = [
  { value: "light", label: "Светлое" },
  { value: "dark", label: "Тёмное" },
];

const readingOptions: Array<{ value: UserPreferences["readingMode"]; label: string }> = [
  { value: "normal", label: "Обычное" },
  { value: "high-contrast", label: "Повышенная читаемость" },
];

export function BrandHeader({
  subtitle,
  action,
  navigationItems = [],
  user,
  settings,
  settingsStatus = "idle",
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: BrandHeaderProps) {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const activeTextSize = textSizeOptions.find((option) => option.value === settings.textSize);
  const activeTheme = themeOptions.find((option) => option.value === settings.theme);
  const activeNavigationItem = navigationItems.find((item) => item.active);

  useEffect(() => {
    if (!isViewMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;

      if (target && viewMenuRef.current?.contains(target)) {
        return;
      }

      setIsViewMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsViewMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (!isNavigationOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;

      if (target && navigationRef.current?.contains(target)) {
        return;
      }

      setIsNavigationOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNavigationOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNavigationOpen]);

  const updateSettings = (nextSettings: Partial<UserPreferences>) => {
    onSettingsChange({ ...settings, ...nextSettings });
  };

  const settingsSummary = [
    activeTextSize?.label ?? "Обычный",
    activeTheme?.label.toLowerCase() ?? "светлое",
    settings.readingMode === "high-contrast" ? "читаемость" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="top-bar">
      <div className="top-bar-main">
        <div className="brand-lockup">
          <span className="brand-logo-mark">
            <img src="/ks-logo-full.png" alt="К-Сервис" className="brand-logo" />
          </span>

          <div>
            <strong>К-Сервис</strong>
            <span>{subtitle}</span>
          </div>
        </div>

        <div className="workplace-title">
          <span>Рабочее место</span>
          <strong>Опросник первой линии</strong>
        </div>
      </div>

      <div className="top-bar-actions">
        {navigationItems.length > 0 && (
          <div className="workspace-navigation" ref={navigationRef}>
            <button
              type="button"
              className="workspace-navigation-toggle"
              aria-expanded={isNavigationOpen}
              onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
            >
              <span>Разделы</span>
              <small>{activeNavigationItem?.label ?? "Выберите раздел"}</small>
            </button>

            {isNavigationOpen && (
              <div className="workspace-navigation-menu" aria-label="Разделы рабочего места">
                {navigationItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`workspace-navigation-item${item.active ? " active" : ""}`}
                    aria-current={item.active ? "page" : undefined}
                    onClick={() => {
                      item.onClick();
                      setIsNavigationOpen(false);
                    }}
                  >
                    <strong>{item.label}</strong>
                    {item.description && <span>{item.description}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {action && (
          <button type="button" className="secondary-button top-file-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}

        <div className="view-menu" ref={viewMenuRef}>
          <button
            type="button"
            className="view-menu-toggle"
            aria-expanded={isViewMenuOpen}
            onClick={() => setIsViewMenuOpen((isOpen) => !isOpen)}
          >
            <span>Настройки вида</span>
            <small>{settingsSummary}</small>
          </button>

          {isViewMenuOpen && (
            <div className="view-settings" aria-label="Настройки внешнего вида">
              <SettingButtons
                label="Размер текста"
                options={textSizeOptions}
                value={settings.textSize}
                onChange={(textSize) => updateSettings({ textSize })}
              />

              <SettingButtons
                label="Оформление"
                options={themeOptions}
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
              />

              <SettingButtons
                label="Чтение"
                options={readingOptions}
                value={settings.readingMode}
                onChange={(readingMode) => updateSettings({ readingMode })}
              />

              <div className="view-settings-footer">
                <p>{getSettingsStatusText(settingsStatus)}</p>

                <button
                  type="button"
                  className="secondary-button view-reset-button"
                  onClick={() => {
                    onSettingsChange({
                      ...settings,
                      theme: defaultUserPreferences.theme,
                      textSize: defaultUserPreferences.textSize,
                      readingMode: defaultUserPreferences.readingMode,
                    });
                  }}
                >
                  Сбросить настройки вида
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="operator-profile" aria-label="Профиль сотрудника">
          <button type="button" className="operator-profile-main" onClick={onOpenProfile}>
            <span className={`operator-avatar profile-color-${settings.profileColor}`}>
              {settings.avatarImage ? (
                <img src={settings.avatarImage} alt="" className="operator-avatar-image" />
              ) : (
                getProfileIconSymbol(settings.profileIcon, user)
              )}
            </span>
            <span className="operator-profile-text">
              <strong>{user?.fullName || "Сотрудник"}</strong>
              <small>{getRoleLabel(user?.role)}</small>
            </span>
          </button>

          {onLogout && (
            <button type="button" className="operator-logout" onClick={onLogout}>
              Выйти
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getSettingsStatusText(status: SettingsStatus): string {
  if (status === "saving") {
    return "Сохраняем настройки в профиле сотрудника...";
  }

  if (status === "saved") {
    return "Настройки сохранены в профиле сотрудника.";
  }

  if (status === "error") {
    return "Не удалось сохранить настройки. Проверьте подключение к серверу.";
  }

  return "Настройки сохраняются в профиле сотрудника и применяются после входа.";
}

function getRoleLabel(role: CurrentUser["role"] | undefined): string {
  if (role === "admin") {
    return "Администратор";
  }

  if (role === "operator") {
    return "Оператор";
  }

  return "Без доступа";
}

function getProfileIconSymbol(
  icon: UserPreferences["profileIcon"],
  user: CurrentUser | undefined,
): string {
  if (icon === "headset") {
    return "☎";
  }

  if (icon === "shield") {
    return "◆";
  }

  if (icon === "star") {
    return "★";
  }

  if (icon === "check") {
    return "✓";
  }

  const source = user?.fullName || user?.login || "Сотрудник";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return initials || "С";
}

function SettingButtons<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: TValue; label: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="view-settings-group">
      <span>{label}</span>
      <div className="view-settings-buttons">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`view-settings-button${option.value === value ? " active" : ""}`}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
