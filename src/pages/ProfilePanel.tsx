import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type {
  ChangePasswordInput,
  CurrentUser,
  UpdateProfileInput,
  UserPreferences,
} from "../shared/api/backendApi";

interface ProfilePanelProps {
  user: CurrentUser;
  onClose: () => void;
  onSave: (input: UpdateProfileInput) => Promise<void>;
  onChangePassword: (input: ChangePasswordInput) => Promise<void>;
}

const maxProfileImageSize = 10 * 1024 * 1024;

const profileIconOptions: Array<{
  value: UserPreferences["profileIcon"];
  label: string;
  symbol: string;
}> = [
  { value: "person", label: "Сотрудник", symbol: "С" },
  { value: "headset", label: "Оператор", symbol: "☎" },
  { value: "shield", label: "Ответственный", symbol: "◆" },
  { value: "star", label: "Опытный", symbol: "★" },
  { value: "check", label: "Контроль", symbol: "✓" },
];

const profileColorOptions: Array<{
  value: UserPreferences["profileColor"];
  label: string;
}> = [
  { value: "teal", label: "Фирменный" },
  { value: "mint", label: "Мятный" },
  { value: "blue", label: "Синий" },
  { value: "amber", label: "Тёплый" },
  { value: "rose", label: "Акцентный" },
];

export function ProfilePanel({ user, onClose, onSave, onChangePassword }: ProfilePanelProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [position, setPosition] = useState(user.position);
  const [profileIcon, setProfileIcon] = useState(user.preferences.profileIcon);
  const [profileColor, setProfileColor] = useState(user.preferences.profileColor);
  const [avatarImage, setAvatarImage] = useState(user.preferences.avatarImage);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeIcon = profileIconOptions.find((option) => option.value === profileIcon) ?? profileIconOptions[0];
  const activeColor = profileColorOptions.find((option) => option.value === profileColor) ?? profileColorOptions[0];
  const completedFields = [fullName, position, email, phone].filter((value) => value.trim()).length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setStatus("idle");
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      return;
    }

    if (file.size > maxProfileImageSize) {
      setError("Картинка слишком большая. Выберите файл до 10 МБ.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result.startsWith("data:image/")) {
        setError("Не удалось подготовить изображение профиля.");
        return;
      }

      setAvatarImage(result);
    };

    reader.onerror = () => {
      setError("Не удалось прочитать файл изображения.");
    };

    reader.readAsDataURL(file);
  }

  function clearProfileImage() {
    setAvatarImage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handlePasswordChange() {
    setPasswordStatus("idle");
    setPasswordError("");

    if (!currentPassword || !newPassword || !repeatPassword) {
      setPasswordStatus("error");
      setPasswordError("Заполните текущий пароль и новый пароль дважды.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus("error");
      setPasswordError("Новый пароль должен быть не короче 8 символов.");
      return;
    }

    if (newPassword !== repeatPassword) {
      setPasswordStatus("error");
      setPasswordError("Новый пароль и повтор не совпадают.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordStatus("error");
      setPasswordError("Новый пароль должен отличаться от текущего.");
      return;
    }

    setPasswordStatus("saving");

    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordStatus("saved");
    } catch (changeError) {
      setPasswordStatus("error");
      setPasswordError(changeError instanceof Error ? changeError.message : "Не удалось сменить пароль.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      await onSave({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        position: position.trim(),
        preferences: {
          ...user.preferences,
          profileIcon,
          profileColor,
          avatarImage,
        },
      });
      setStatus("saved");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль.");
    }
  }

  return (
    <div className="profile-panel-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="profile-panel profile-panel-rich"
        aria-label="Профиль сотрудника"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-panel-header">
          <div>
            <p className="page-kicker">Профиль сотрудника</p>
            <h2>Личная карточка</h2>
          </div>

          <button type="button" className="secondary-button profile-close-button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <section className={`profile-summary-card profile-color-${profileColor}`}>
          <div className="profile-summary-picture" aria-hidden="true">
            {avatarImage ? <img src={avatarImage} alt="" /> : activeIcon.symbol}
          </div>

          <div className="profile-summary-main">
            <span>{getRoleLabel(user.role)}</span>
            <strong>{fullName.trim() || user.login}</strong>
            <small>{position.trim() || "Должность пока не заполнена"}</small>
          </div>

          <span className={user.active ? "profile-status active" : "profile-status blocked"}>
            {user.active ? "Доступ открыт" : "Доступ закрыт"}
          </span>
        </section>

        <div className="profile-mini-grid">
          <div>
            <span>Логин</span>
            <strong>{user.login}</strong>
          </div>
          <div>
            <span>Заполнено</span>
            <strong>{completedFields} из 4</strong>
          </div>
          <div>
            <span>Оформление</span>
            <strong>{getThemeLabel(user.preferences.theme)}</strong>
          </div>
        </div>

        <form className="profile-form profile-form-rich" onSubmit={handleSubmit}>
          <section className="profile-section-card">
            <div className="profile-section-heading">
              <div>
                <span>Данные</span>
                <h3>Контакты и должность</h3>
              </div>
            </div>

            <div className="profile-fields-grid">
              <label>
                <span>ФИО</span>
                <input className="field" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>

              <label>
                <span>Должность</span>
                <input className="field" value={position} onChange={(event) => setPosition(event.target.value)} />
              </label>

              <label>
                <span>Электронная почта</span>
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label>
                <span>Телефон</span>
                <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="profile-section-card profile-password-card">
            <div className="profile-section-heading">
              <div>
                <span>Безопасность</span>
                <h3>Смена пароля</h3>
              </div>
              <small>Если браузер ругается на пароль, смените его здесь</small>
            </div>

            <div className="profile-fields-grid profile-password-grid">
              <label>
                <span>Текущий пароль</span>
                <input
                  className="field"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>

              <label>
                <span>Новый пароль</span>
                <input
                  className="field"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <label>
                <span>Повторите новый пароль</span>
                <input
                  className="field"
                  type="password"
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>

            {passwordStatus === "saved" && (
              <div className="profile-save-success">Пароль изменён. Используйте его при следующем входе.</div>
            )}
            {passwordError && <div className="validation-error">{passwordError}</div>}

            <div className="profile-password-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handlePasswordChange}
                disabled={passwordStatus === "saving"}
              >
                {passwordStatus === "saving" ? "Меняем пароль..." : "Сменить пароль"}
              </button>
            </div>
          </section>

          <details className="profile-settings-details">
            <summary>
              <div>
                <span>Оформление профиля</span>
                <strong>Картинка профиля</strong>
              </div>
              <small>
                {avatarImage
                  ? "В шапке используется своя картинка"
                  : `В шапке используется готовая иконка: ${activeIcon.label}, ${activeColor.label.toLowerCase()}`}
              </small>
              <span className="details-chevron" aria-hidden="true" />
            </summary>

            <div className="profile-settings-body">
              <section className="profile-image-card">
                <div className="profile-section-heading">
                  <div>
                    <span>Картинка</span>
                    <h3>Своя картинка профиля</h3>
                  </div>
                  <small>До 10 МБ</small>
                </div>

                <div className="profile-image-row">
                  <div className={`profile-image-preview profile-color-${profileColor}`} aria-hidden="true">
                    {avatarImage ? <img src={avatarImage} alt="" /> : activeIcon.symbol}
                  </div>

                  <div className="profile-image-controls">
                    <p>
                      Можно выбрать фотографию или небольшой знак. Если картинка не выбрана,
                      в шапке будет показана готовая иконка.
                    </p>

                    <input
                      ref={fileInputRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />

                    <div className="profile-image-buttons">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Выбрать картинку
                      </button>

                      {avatarImage && (
                        <button type="button" className="secondary-button" onClick={clearProfileImage}>
                          Убрать картинку
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {!avatarImage && (
                <section className="profile-image-card">
                  <div className="profile-section-heading">
                    <div>
                      <span>Запасной вариант</span>
                      <h3>Готовая иконка</h3>
                    </div>
                    <small>Используется без своей картинки</small>
                  </div>

                  <div className="profile-icon-grid">
                    {profileIconOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`profile-icon-choice${option.value === profileIcon ? " active" : ""}`}
                        aria-pressed={option.value === profileIcon}
                        onClick={() => setProfileIcon(option.value)}
                      >
                        <span className={`operator-avatar profile-color-${profileColor}`}>{option.symbol}</span>
                        <strong>{option.label}</strong>
                      </button>
                    ))}
                  </div>

                </section>
              )}

              <section className="profile-image-card profile-color-card">
                <div className="profile-section-heading">
                  <div>
                    <span>Цвет профиля</span>
                    <h3>{avatarImage ? "Обводка картинки" : "Цвет готовой иконки"}</h3>
                  </div>
                  <small>Применяется в шапке</small>
                </div>

                <div className="profile-color-row">
                  {profileColorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`profile-color-choice profile-color-${option.value}${
                        option.value === profileColor ? " active" : ""
                      }`}
                      aria-pressed={option.value === profileColor}
                      onClick={() => setProfileColor(option.value)}
                    >
                      <span />
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </details>

          <section className="profile-section-card profile-preferences-card">
            <div>
              <span>Настройки рабочего места</span>
              <strong>{getTextSizeLabel(user.preferences.textSize)}</strong>
              <small>{getReadingLabel(user.preferences.readingMode)}</small>
            </div>
            <p>Размер текста, тема и режим чтения меняются в шапке приложения.</p>
          </section>

          {status === "saved" && <div className="profile-save-success">Профиль сохранён.</div>}
          {error && <div className="validation-error">{error}</div>}

          <div className="profile-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Не сохранять
            </button>
            <button type="submit" className="primary-button profile-save-button" disabled={status === "saving"}>
              {status === "saving" ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function getRoleLabel(role: CurrentUser["role"]): string {
  if (role === "admin") {
    return "Администратор";
  }

  if (role === "operator") {
    return "Оператор";
  }

  return "Без доступа";
}

function getThemeLabel(theme: UserPreferences["theme"]): string {
  return theme === "dark" ? "Тёмное" : "Светлое";
}

function getTextSizeLabel(textSize: UserPreferences["textSize"]): string {
  if (textSize === "xlarge") {
    return "Очень крупный текст";
  }

  if (textSize === "large") {
    return "Крупный текст";
  }

  return "Обычный текст";
}

function getReadingLabel(readingMode: UserPreferences["readingMode"]): string {
  return readingMode === "high-contrast" ? "Повышенная читаемость" : "Обычная читаемость";
}
