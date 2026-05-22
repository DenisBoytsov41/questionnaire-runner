import { useMemo, useState } from "react";
import type {
  AdminUser,
  CurrentUser,
  UserPreferences,
  UserRole,
} from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";

interface AdminUsersPageProps {
  users: AdminUser[];
  status: "loading" | "ready" | "error";
  error: string;
  onRefresh: () => void;
  onUpdateUser: (userId: string, input: { role: UserRole; active: boolean }) => Promise<void>;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

const roleOptions: Array<{ value: UserRole; label: string; description: string }> = [
  {
    value: "user",
    label: "Без доступа",
    description: "Может войти, но не видит рабочие сценарии.",
  },
  {
    value: "operator",
    label: "Оператор",
    description: "Проходит сценарии и работает со своими обращениями.",
  },
  {
    value: "admin",
    label: "Администратор",
    description: "Управляет пользователями и сценариями.",
  },
];

export function AdminUsersPage({
  users,
  status,
  error,
  onRefresh,
  onUpdateUser,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: AdminUsersPageProps) {
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [searchText, setSearchText] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [localError, setLocalError] = useState("");
  const isLoading = status === "loading";

  const filteredUsers = useMemo(
    () => filterUsers(users, roleFilter, searchText),
    [roleFilter, searchText, users],
  );

  async function updateAccess(targetUser: AdminUser, input: { role?: UserRole; active?: boolean }) {
    setSavingUserId(targetUser.id);
    setLocalError("");

    try {
      await onUpdateUser(targetUser.id, {
        role: input.role ?? targetUser.role,
        active: input.active ?? targetUser.active,
      });
    } catch (updateError) {
      setLocalError(
        updateError instanceof Error ? updateError.message : "Не удалось сохранить доступ сотрудника.",
      );
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Управление сотрудниками"
        navigationItems={navigationItems}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <section className="admin-users-page">
        <div className="admin-users-hero">
          <div>
            <p className="page-kicker">Администрирование</p>
            <h1>Пользователи и доступ</h1>
            <p>
              Здесь администратор назначает роль сотрудника и может временно закрыть вход.
              Новая учётная запись сначала получает статус “без доступа”, пока ей не назначат роль.
            </p>
          </div>

          <div className="admin-users-metrics">
            <AdminMetric label="Всего" value={users.length} />
            <AdminMetric label="Операторы" value={users.filter((item) => item.role === "operator").length} />
            <AdminMetric label="Без доступа" value={users.filter((item) => item.role === "user").length} />
          </div>
        </div>

        <div className="admin-users-toolbar">
          <label className="runs-search">
            <span>Найти сотрудника</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="ФИО, логин, должность или почта"
            />
          </label>

          <div className="runs-filter-group" aria-label="Фильтр по роли">
            <button
              type="button"
              className={roleFilter === "all" ? "active" : ""}
              onClick={() => setRoleFilter("all")}
            >
              Все
            </button>
            {roleOptions.map((role) => (
              <button
                key={role.value}
                type="button"
                className={roleFilter === role.value ? "active" : ""}
                onClick={() => setRoleFilter(role.value)}
              >
                {role.label}
              </button>
            ))}
          </div>

          <button type="button" className="secondary-button runs-refresh-button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        {(error || localError) && (
          <div className="notice-block">
            <p>{localError || error}</p>
          </div>
        )}

        {isLoading && users.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Загрузка</p>
            <h2>Получаем сотрудников</h2>
            <p>Проверяем список пользователей и их права доступа.</p>
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Пока пусто</p>
            <h2>Подходящих сотрудников нет</h2>
            <p>Попробуйте изменить фильтр или строку поиска.</p>
          </div>
        )}

        {filteredUsers.length > 0 && (
          <div className="admin-users-list">
            {filteredUsers.map((employee) => {
              const isSelf = employee.id === user.id;
              const isSaving = savingUserId === employee.id;

              return (
                <article key={employee.id} className={`admin-user-card ${employee.active ? "" : "blocked"}`}>
                  <div className="admin-user-summary">
                    <span className={`operator-avatar profile-color-${employee.preferences.profileColor}`}>
                      {employee.preferences.avatarImage ? (
                        <img src={employee.preferences.avatarImage} alt="" className="operator-avatar-image" />
                      ) : (
                        getInitials(employee)
                      )}
                    </span>

                    <div>
                      <span className={`run-status ${employee.active ? "finished" : "draft"}`}>
                        {employee.active ? "Активен" : "Вход закрыт"}
                      </span>
                      <h2>{employee.fullName || employee.login}</h2>
                      <p>
                        Логин: {employee.login}
                        {employee.position ? `, должность: ${employee.position}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="admin-user-access">
                    <label>
                      <span>Роль</span>
                      <select
                        value={employee.role}
                        disabled={isSaving}
                        onChange={(event) => updateAccess(employee, { role: event.target.value as UserRole })}
                      >
                        {roleOptions.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSaving || isSelf}
                      onClick={() => updateAccess(employee, { active: !employee.active })}
                    >
                      {employee.active ? "Закрыть вход" : "Открыть вход"}
                    </button>
                  </div>

                  <div className="admin-user-details">
                    <span>{getRoleDescription(employee.role)}</span>
                    <span>{employee.email || "Почта не указана"}</span>
                    <span>{employee.phone || "Телефон не указан"}</span>
                    {isSelf && <span>Это ваша учётная запись</span>}
                    {isSaving && <span>Сохраняем изменения...</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function filterUsers(users: AdminUser[], roleFilter: "all" | UserRole, searchText: string): AdminUser[] {
  const normalizedSearch = searchText.trim().toLowerCase();

  return users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = [
      user.login,
      user.fullName,
      user.email,
      user.phone,
      user.position,
      getRoleLabel(user.role),
    ].join(" ").toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

function getInitials(user: AdminUser): string {
  const source = user.fullName || user.login || "Сотрудник";
  const initials = source
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "С";
}

function getRoleLabel(role: UserRole): string {
  return roleOptions.find((option) => option.value === role)?.label ?? "Без доступа";
}

function getRoleDescription(role: UserRole): string {
  return roleOptions.find((option) => option.value === role)?.description ?? "";
}
