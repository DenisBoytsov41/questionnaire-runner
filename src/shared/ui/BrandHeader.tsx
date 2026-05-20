import { useEffect, useState } from "react";

interface BrandHeaderProps {
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

type TextScale = "normal" | "large" | "extra";
type ThemeMode = "light" | "dark";
type VisionMode = "default" | "easy";

type UiSettings = {
  textScale: TextScale;
  theme: ThemeMode;
  visionMode: VisionMode;
};

const settingsStorageKey = "ks-questionnaire-view-settings";

const defaultSettings: UiSettings = {
  textScale: "normal",
  theme: "light",
  visionMode: "default",
};

const textScaleOptions: Array<{ value: TextScale; label: string }> = [
  { value: "normal", label: "Обычный" },
  { value: "large", label: "Крупнее" },
  { value: "extra", label: "Очень крупный" },
];

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Светлое" },
  { value: "dark", label: "Тёмное" },
];

const visionOptions: Array<{ value: VisionMode; label: string }> = [
  { value: "default", label: "Обычное" },
  { value: "easy", label: "Повышенная читаемость" },
];

export function BrandHeader({ subtitle, action }: BrandHeaderProps) {
  const [settings, setSettings] = useState<UiSettings>(readSettings);
  const activeTextScale = textScaleOptions.find((option) => option.value === settings.textScale);
  const activeTheme = themeOptions.find((option) => option.value === settings.theme);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.textScale = settings.textScale;
    root.dataset.theme = settings.theme;
    root.dataset.vision = settings.visionMode;

    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch {
      // Настройки вида не критичны для прохождения опросника.
    }
  }, [settings]);

  const updateSettings = (nextSettings: Partial<UiSettings>) => {
    setSettings((currentSettings) => ({ ...currentSettings, ...nextSettings }));
  };

  return (
    <div className="top-bar">
      <div className="brand-lockup">
        <span className="brand-logo-mark">
          <img src="/ks-logo-full.png" alt="К-Сервис" className="brand-logo" />
        </span>

        <div>
          <strong>К-Сервис</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="top-bar-actions">
        <div className="operator-profile" aria-label="Профиль оператора">
          <span className="operator-avatar">ОП</span>
          <div>
            <strong>Оператор первой линии</strong>
            <span>Вход будет подключён позже</span>
          </div>
        </div>

        <details className="view-menu">
          <summary>
            <span>Настройки вида</span>
            <small>
              {activeTextScale?.label}, {activeTheme?.label.toLowerCase()}
              {settings.visionMode === "easy" ? ", читаемость" : ""}
            </small>
          </summary>

          <div className="view-settings" aria-label="Настройки внешнего вида">
            <SettingButtons
              label="Размер текста"
              options={textScaleOptions}
              value={settings.textScale}
              onChange={(textScale) => updateSettings({ textScale })}
            />

            <SettingButtons
              label="Оформление"
              options={themeOptions}
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
            />

            <SettingButtons
              label="Чтение"
              options={visionOptions}
              value={settings.visionMode}
              onChange={(visionMode) => updateSettings({ visionMode })}
            />

            <p className="view-settings-note">
              Эти параметры сохраняются только в этом браузере. После подключения входа их можно будет хранить в
              профиле сотрудника.
            </p>
          </div>
        </details>

        {action && (
          <button type="button" className="secondary-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
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

function readSettings(): UiSettings {
  try {
    const rawSettings = localStorage.getItem(settingsStorageKey);

    if (!rawSettings) {
      return defaultSettings;
    }

    const parsedSettings = JSON.parse(rawSettings) as Partial<UiSettings>;

    return {
      textScale: isTextScale(parsedSettings.textScale) ? parsedSettings.textScale : "normal",
      theme: isThemeMode(parsedSettings.theme) ? parsedSettings.theme : "light",
      visionMode: isVisionMode(parsedSettings.visionMode) ? parsedSettings.visionMode : "default",
    };
  } catch {
    return defaultSettings;
  }
}

function isTextScale(value: unknown): value is TextScale {
  return value === "normal" || value === "large" || value === "extra";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function isVisionMode(value: unknown): value is VisionMode {
  return value === "default" || value === "easy";
}
