import { useState } from "react";
import type { FormEvent } from "react";
import type { CurrentUser } from "../shared/api/backendApi";
import { loginToBackend } from "../shared/api/backendApi";

interface LoginPageProps {
  onLogin: (token: string, user: CurrentUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!login.trim() || !password) {
      setError("Введите логин и пароль.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await loginToBackend(login.trim(), password);
      onLogin(result.token, result.user);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-logo-mark">
            <img src="/ks-logo-full.png" alt="К-Сервис" className="brand-logo" />
          </span>

          <div>
            <strong>К-Сервис</strong>
            <span>Опросник первой линии</span>
          </div>
        </div>

        <div className="login-intro">
          <p className="page-kicker">Вход сотрудника</p>
          <h1>Откройте рабочее место оператора</h1>
          <p>
            Войдите под своей учётной записью. После входа будут доступны сценарии, профиль и сохранение результатов.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Логин</span>
            <input
              className="field"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label>
            <span>Пароль</span>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="validation-error">{error}</div>}

          <button type="submit" className="primary-button login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Проверяем..." : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}
