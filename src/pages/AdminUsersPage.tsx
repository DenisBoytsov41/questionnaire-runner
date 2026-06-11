import { useState, type FormEvent } from "react";
import type {
  AdminUser,
  AdminUsersSummary,
  CreateAdminUserInput,
  CurrentUser,
  ListPageParams,
  PaginationMeta,
  UserPreferences,
  UserRole,
} from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";
import { canManageUser } from "../shared/lib/access";
import { Pagination } from "../shared/ui/Pagination";
import { RoundedSelect } from "../shared/ui/RoundedSelect";

interface AdminUsersPageProps {
  users: AdminUser[];
  summary: AdminUsersSummary;
  pagination: PaginationMeta;
  params: Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "role">>;
  status: "loading" | "ready" | "error";
  error: string;
  onRefresh: () => void;
  onParamsChange: (params: Partial<Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "role">>>) => void;
  onCreateUser: (input: CreateAdminUserInput) => Promise<void>;
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
    description: "Управляет операторами и сценариями, но не может изменять других администраторов.",
  },
  {
    value: "superadmin",
    label: "Главный администратор",
    description: "Управляет администраторами и всей системой. Системная защищённая учётная запись.",
  },
];

export function AdminUsersPage({
  users,
  summary,
  pagination,
  params,
  status,
  error,
  onRefresh,
  onParamsChange,
  onCreateUser,
  onUpdateUser,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: AdminUsersPageProps) {
  const [savingUserId, setSavingUserId] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState<CreateAdminUserInput>({
    fullName: "",
    login: "",
    password: "",
    position: "Оператор первой линии",
    email: "",
    phone: "",
    role: "operator",
    active: true,
  });
  const [localError, setLocalError] = useState("");
  const isLoading = status === "loading";
  const assignableRoleOptions = user.role === "superadmin"
    ? roleOptions.filter((option) => option.value !== "superadmin")
    : roleOptions.filter((option) => option.value === "user" || option.value === "operator");

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

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    setCreateSuccess("");

    if (!createForm.fullName.trim() || !createForm.login.trim() || !createForm.password.trim()) {
      setLocalError("Заполните ФИО, логин и пароль нового сотрудника.");
      return;
    }

    setIsCreatingUser(true);

    try {
      await onCreateUser({
        ...createForm,
        fullName: createForm.fullName.trim(),
        login: createForm.login.trim(),
        password: createForm.password,
        position: createForm.position?.trim(),
        email: createForm.email?.trim(),
        phone: createForm.phone?.trim(),
      });
      setCreateSuccess("Сотрудник создан. Он уже может войти под своим логином и паролем.");
      setCreateForm({
        fullName: "",
        login: "",
        password: "",
        position: "Оператор первой линии",
        email: "",
        phone: "",
        role: "operator",
        active: true,
      });
    } catch (createError) {
      setLocalError(
        createError instanceof Error ? createError.message : "Не удалось создать сотрудника.",
      );
    } finally {
      setIsCreatingUser(false);
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
              Администраторы управляют операторами и сценариями. Главный администратор дополнительно
              назначает администраторов и управляет их доступом.
            </p>
          </div>

          <div className="admin-users-metrics">
            <AdminMetric label="Всего" value={summary.totalUsers} />
            <AdminMetric label="Операторы" value={summary.operatorUsers} />
            <AdminMetric label="Без доступа" value={summary.noAccessUsers} />
          </div>
        </div>

        <div className="admin-users-toolbar">
          <label className="runs-search">
            <span>Найти сотрудника</span>
            <input
              type="search"
              value={params.search}
              onChange={(event) => onParamsChange({ search: event.target.value })}
              placeholder="ФИО, логин, должность или почта"
            />
          </label>

          <div className="runs-filter-group" aria-label="Фильтр по роли">
            <button
              type="button"
              className={params.role === "all" ? "active" : ""}
              onClick={() => onParamsChange({ role: "all" })}
            >
              Все
            </button>
            {roleOptions.map((role) => (
              <button
                key={role.value}
                type="button"
                className={params.role === role.value ? "active" : ""}
                onClick={() => onParamsChange({ role: role.value })}
              >
                {role.label}
              </button>
            ))}
          </div>

          <button type="button" className="secondary-button runs-refresh-button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        <form className="admin-user-create-card" onSubmit={createEmployee}>
          <div className="admin-user-create-header">
            <div>
              <p className="page-kicker">Новый сотрудник</p>
              <h2>Создать оператора</h2>
              <p>
                Заполните данные для входа, задайте временный пароль и выберите, будет ли доступ открыт сразу.
              </p>
            </div>

            <span className="admin-user-create-badge">Создаётся в базе</span>
          </div>

          <div className="admin-user-create-layout">
            <div className="admin-user-create-fields">
              <div className="admin-user-create-grid">
                <label>
                  <span>ФИО</span>
                  <input
                    value={createForm.fullName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Иванов Иван"
                    autoComplete="name"
                  />
                </label>

                <label>
                  <span>Логин</span>
                  <input
                    value={createForm.login}
                    onChange={(event) => setCreateForm((current) => ({ ...current, login: event.target.value }))}
                    placeholder="ivanov"
                    autoComplete="username"
                  />
                </label>

                <label>
                  <span>Временный пароль</span>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Не меньше 6 символов"
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  <span>Должность</span>
                  <input
                    value={createForm.position}
                    onChange={(event) => setCreateForm((current) => ({ ...current, position: event.target.value }))}
                    placeholder="Оператор первой линии"
                    autoComplete="organization-title"
                  />
                </label>

                <label>
                  <span>Электронная почта</span>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="operator@k-service44.ru"
                    autoComplete="email"
                  />
                </label>

                <label>
                  <span>Телефон</span>
                  <input
                    value={createForm.phone}
                    onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+7 900 000-00-00"
                    autoComplete="tel"
                  />
                </label>
              </div>
            </div>

            <aside className="admin-user-create-side" aria-label="Доступ нового сотрудника">
              <div className="admin-user-create-side-card">
                <label>
                  <span>Роль</span>
                  <RoundedSelect
                    value={createForm.role}
                    options={assignableRoleOptions}
                    ariaLabel="Роль нового сотрудника"
                    onChange={(role) => setCreateForm((current) => ({ ...current, role }))}
                  />
                </label>

                <label className="admin-user-create-switch">
                  <input
                    type="checkbox"
                    checked={createForm.active}
                    onChange={(event) => setCreateForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  <span>Сразу открыть вход</span>
                </label>
              </div>

              <button type="submit" className="primary-button admin-user-create-submit" disabled={isCreatingUser}>
                {isCreatingUser ? "Создаём..." : "Создать сотрудника"}
              </button>

              <p className="admin-user-create-hint">
                После создания сотрудник сможет войти по логину и временному паролю. Роль можно изменить ниже в списке.
              </p>
            </aside>
          </div>

          {createSuccess && <p className="admin-user-create-success">{createSuccess}</p>}
        </form>

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

        {!isLoading && users.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Пока пусто</p>
            <h2>Подходящих сотрудников нет</h2>
            <p>Попробуйте изменить фильтр или строку поиска.</p>
          </div>
        )}

        {users.length > 0 && (
          <>
            <div className="admin-users-list">
              {users.map((employee) => {
              const isSelf = employee.id === user.id;
              const isSaving = savingUserId === employee.id;
              const canManageEmployee = !isSelf && canManageUser(user.role, employee.role);
              const accessRestriction = getAccessRestriction(user.role, employee.role, isSelf);

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
                      <RoundedSelect
                        value={employee.role}
                        disabled={isSaving || !canManageEmployee}
                        options={canManageEmployee ? assignableRoleOptions : roleOptions}
                        ariaLabel={`Роль сотрудника ${employee.fullName || employee.login}`}
                        onChange={(role) => updateAccess(employee, { role })}
                        title={accessRestriction}
                      />
                    </label>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSaving || !canManageEmployee}
                      onClick={() => updateAccess(employee, { active: !employee.active })}
                      title={accessRestriction}
                    >
                      {employee.active ? "Закрыть вход" : "Открыть вход"}
                    </button>
                  </div>

                  <div className="admin-user-details">
                    <span>{getRoleDescription(employee.role)}</span>
                    <span>{employee.email || "Почта не указана"}</span>
                    <span>{employee.phone || "Телефон не указан"}</span>
                    {isSelf && <span>Это ваша учётная запись</span>}
                    {!isSelf && accessRestriction && <span>{accessRestriction}</span>}
                    {isSaving && <span>Сохраняем изменения...</span>}
                  </div>
                </article>
              );
              })}
            </div>
            <Pagination
              label="сотрудников"
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              onPageChange={(page) => onParamsChange({ page })}
              onPageSizeChange={(pageSize) => onParamsChange({ page: 1, pageSize })}
            />
          </>
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

function getRoleDescription(role: UserRole): string {
  return roleOptions.find((option) => option.value === role)?.description ?? "";
}

function getAccessRestriction(
  actorRole: UserRole,
  targetRole: UserRole,
  isSelf: boolean,
): string | undefined {
  if (isSelf) {
    return "Свою роль и доступ нельзя менять на этой странице.";
  }

  if (targetRole === "superadmin") {
    return "Учётная запись главного администратора защищена.";
  }

  if (actorRole !== "superadmin" && targetRole === "admin") {
    return "Управлять администраторами может только главный администратор.";
  }

  return undefined;
}
