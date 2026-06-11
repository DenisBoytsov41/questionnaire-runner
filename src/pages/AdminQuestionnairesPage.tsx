import { useRef, useState } from "react";
import type {
  AdminQuestionnaire,
  AdminQuestionnairesSummary,
  CurrentUser,
  ImportQuestionnairesResult,
  ListPageParams,
  PaginationMeta,
  UserPreferences,
} from "../shared/api/backendApi";
import { parseQuestionnaireJsonText, readJsonFile } from "../shared/api/questionnaireApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";
import { Pagination } from "../shared/ui/Pagination";

interface AdminQuestionnairesPageProps {
  questionnaires: AdminQuestionnaire[];
  pagination: PaginationMeta;
  summary: AdminQuestionnairesSummary;
  params: Required<Pick<ListPageParams, "page" | "pageSize" | "search">>;
  status: "loading" | "ready" | "error";
  error: string;
  onRefresh: () => void;
  onParamsChange: (params: Partial<Required<Pick<ListPageParams, "page" | "pageSize" | "search">>>) => void;
  onImportJson: (input: unknown) => Promise<ImportQuestionnairesResult[]>;
  onPublishVersion: (questionnaireId: string, versionId: string) => Promise<void>;
  onDeleteQuestionnaire: (questionnaireId: string) => Promise<void>;
  onDeleteVersion: (questionnaireId: string, versionId: string) => Promise<void>;
  onOpenAsOperator: (questionnaireId: string) => Promise<void>;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function AdminQuestionnairesPage({
  questionnaires,
  pagination,
  summary,
  params,
  status,
  error,
  onRefresh,
  onParamsChange,
  onImportJson,
  onPublishVersion,
  onDeleteQuestionnaire,
  onDeleteVersion,
  onOpenAsOperator,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: AdminQuestionnairesPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [expandedVersionsById, setExpandedVersionsById] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState("");
  const [imported, setImported] = useState<ImportQuestionnairesResult[]>([]);
  const [importStatus, setImportStatus] = useState<"idle" | "loading">("idle");
  const [publishingVersionId, setPublishingVersionId] = useState("");
  const [deletingQuestionnaireId, setDeletingQuestionnaireId] = useState("");
  const [deletingVersionId, setDeletingVersionId] = useState("");
  const [openingQuestionnaireId, setOpeningQuestionnaireId] = useState("");
  const isLoading = status === "loading";

  async function importInput(input: unknown) {
    setImportStatus("loading");
    setLocalError("");
    setImported([]);

    try {
      const result = await onImportJson(input);
      setImported(result);
      setJsonText("");
      onRefresh();
    } catch (importError) {
      setLocalError(importError instanceof Error ? importError.message : "Не удалось загрузить сценарий в базу.");
    } finally {
      setImportStatus("idle");
    }
  }

  function importFromText() {
    const parsed = parseQuestionnaireJsonText(jsonText);

    if (!parsed.ok) {
      setLocalError(parsed.errors.join("\n"));
      setImported([]);
      return;
    }

    void importInput(parsed.input);
  }

  async function importFromFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const parsed = await readJsonFile(file);

    if (!parsed.ok) {
      setLocalError(parsed.errors.join("\n"));
      setImported([]);
      return;
    }

    void importInput(parsed.input);
  }

  async function publishVersion(questionnaireId: string, versionId: string) {
    setPublishingVersionId(versionId);
    setLocalError("");

    try {
      await onPublishVersion(questionnaireId, versionId);
      onRefresh();
    } catch (publishError) {
      setLocalError(
        publishError instanceof Error ? publishError.message : "Не удалось опубликовать выбранную версию.",
      );
    } finally {
      setPublishingVersionId("");
    }
  }

  async function openAsOperator(questionnaireId: string) {
    setOpeningQuestionnaireId(questionnaireId);
    setLocalError("");

    try {
      await onOpenAsOperator(questionnaireId);
    } catch (openError) {
      setLocalError(openError instanceof Error ? openError.message : "Не удалось открыть сценарий как оператор.");
    } finally {
      setOpeningQuestionnaireId("");
    }
  }

  async function deleteQuestionnaire(questionnaire: AdminQuestionnaire) {
    const confirmed = window.confirm(
      `Удалить сценарий «${questionnaire.title}»?\n\nОн исчезнет из списка и рабочего места операторов. Сохранённые прохождения останутся в истории.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingQuestionnaireId(questionnaire.id);
    setLocalError("");

    try {
      await onDeleteQuestionnaire(questionnaire.id);
      onRefresh();
    } catch (deleteError) {
      setLocalError(
        deleteError instanceof Error ? deleteError.message : "Не удалось удалить сценарий.",
      );
    } finally {
      setDeletingQuestionnaireId("");
    }
  }

  async function deleteVersion(
    questionnaire: AdminQuestionnaire,
    versionId: string,
    versionNumber: number,
    isCurrent: boolean,
  ) {
    const isLastVersion = questionnaire.versions.length === 1;
    const currentWarning = isCurrent
      ? "\n\nЭто текущая версия. После удаления сценарий исчезнет из рабочего места операторов."
      : "";
    const lastVersionWarning = isLastVersion
      ? "\n\nЭто единственная версия, поэтому сценарий также будет полностью удалён."
      : "";
    const confirmed = window.confirm(
      `Удалить версию ${versionNumber} сценария «${questionnaire.title}»?${currentWarning}${lastVersionWarning}`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingVersionId(versionId);
    setLocalError("");

    try {
      await onDeleteVersion(questionnaire.id, versionId);
      onRefresh();
    } catch (deleteError) {
      setLocalError(
        deleteError instanceof Error ? deleteError.message : "Не удалось удалить версию сценария.",
      );
    } finally {
      setDeletingVersionId("");
    }
  }

  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="Управление сценариями"
        navigationItems={navigationItems}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <section className="admin-questionnaires-page">
        <div className="admin-users-hero">
          <div>
            <p className="page-kicker">Администрирование</p>
            <h1>Сценарии из 1С</h1>
            <p>
              Здесь администратор загружает выгрузку из 1С, проверяет версии и выбирает, какой сценарий будет
              доступен операторам в рабочем месте.
            </p>
          </div>

          <div className="admin-users-metrics">
            <AdminMetric label="Сценариев" value={summary.totalQuestionnaires} />
            <AdminMetric label="Версий" value={summary.totalVersions} />
            <AdminMetric label="В работе" value={summary.activeQuestionnaires} />
          </div>
        </div>

        <div className="admin-questionnaires-grid">
          <section className="admin-questionnaire-upload">
            <div className="admin-questionnaire-section-header">
              <div>
                <p className="page-kicker">Загрузка</p>
                <h2>Добавить выгрузку из 1С</h2>
              </div>
              <span>Проверка перед сохранением</span>
            </div>

            <div className="admin-questionnaire-upload-actions">
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  void importFromFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()}>
                Выбрать JSON-файл
              </button>
              <button type="button" className="secondary-button" onClick={importFromText} disabled={importStatus === "loading"}>
                {importStatus === "loading" ? "Загружаем..." : "Загрузить из текста"}
              </button>
            </div>

            <label className="admin-questionnaire-textarea-label">
              <span>JSON из 1С</span>
              <textarea
                className="admin-questionnaire-textarea"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                placeholder="Вставьте сюда содержимое файла из 1С, если не хотите выбирать файл."
              />
            </label>
          </section>

          <aside className="admin-questionnaire-help">
            <p className="page-kicker">Перед публикацией</p>
            <h2>Что проверяем</h2>
            <ul>
              <li>Структуру JSON и версию схемы.</li>
              <li>Вопросы, разделы и варианты ответов.</li>
              <li>Переходы на существующие вопросы.</li>
              <li>Поддержку одиночного файла и набора сценариев.</li>
            </ul>
            <p>После загрузки новая версия появится в списке ниже. При необходимости её можно опубликовать повторно.</p>
          </aside>
        </div>

        {(error || localError) && (
          <div className="notice-block admin-questionnaires-notice">
            {(localError || error).split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        {imported.length > 0 && (
          <div className="admin-questionnaires-import-result">
            <p className="page-kicker">Загружено</p>
            <h2>Новые версии добавлены в базу</h2>
            <div>
              {imported.map((item) => (
                <span key={item.versionId}>
                  {item.title}: версия {item.version}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="admin-users-toolbar admin-questionnaires-toolbar">
          <label className="runs-search">
            <span>Найти сценарий</span>
            <input
              type="search"
              value={params.search}
              onChange={(event) => onParamsChange({ search: event.target.value })}
              placeholder="Название, код или номер версии"
            />
          </label>

          <button type="button" className="secondary-button runs-refresh-button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        {isLoading && questionnaires.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Загрузка</p>
            <h2>Получаем сценарии из базы</h2>
            <p>Проверяем сохранённые опросники и их версии.</p>
          </div>
        )}

        {!isLoading && questionnaires.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Пока пусто</p>
            <h2>Сценариев в базе нет</h2>
            <p>Загрузите JSON из 1С через блок выше. После этого сценарий появится здесь.</p>
          </div>
        )}

        {questionnaires.length > 0 && (
          <>
          <div className="admin-questionnaire-list">
            {questionnaires.map((questionnaire) => {
              const isVersionsExpanded = expandedVersionsById[questionnaire.id] ?? false;
              const visibleVersions = isVersionsExpanded
                ? questionnaire.versions
                : questionnaire.versions.slice(0, 3);

              return (
              <article key={questionnaire.id} className="admin-questionnaire-card">
                <div className="admin-questionnaire-card-header">
                  <div>
                    <span className={`run-status ${questionnaire.archived ? "draft" : "finished"}`}>
                      {questionnaire.archived ? "В архиве" : "Доступен"}
                    </span>
                    <h2>{questionnaire.title}</h2>
                    <p>Код сценария: {questionnaire.id}</p>
                  </div>
                  <div className="admin-questionnaire-card-actions">
                    <div className="admin-questionnaire-card-meta">
                      <span>Версий: {questionnaire.versions.length}</span>
                      <span>Обновлён: {formatDateTime(questionnaire.updatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button danger-soft-button"
                      disabled={deletingQuestionnaireId === questionnaire.id}
                      onClick={() => void deleteQuestionnaire(questionnaire)}
                    >
                      {deletingQuestionnaireId === questionnaire.id ? "Удаляем..." : "Удалить сценарий"}
                    </button>
                  </div>
                </div>

                <div className="admin-questionnaire-current-state">
                  <div>
                    <span className="page-kicker">Состояние для оператора</span>
                    <strong>
                      {questionnaire.activeVersionId
                        ? "Сценарий виден операторам"
                        : "Нет опубликованной версии"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!questionnaire.activeVersionId || openingQuestionnaireId === questionnaire.id}
                    onClick={() => void openAsOperator(questionnaire.id)}
                  >
                    {openingQuestionnaireId === questionnaire.id ? "Открываем..." : "Открыть как оператор"}
                  </button>
                </div>

                <div className="admin-questionnaire-versions">
                  {visibleVersions.map((version) => {
                    const isCurrent = version.id === questionnaire.activeVersionId;
                    const isPublishing = publishingVersionId === version.id;
                    const isDeleting = deletingVersionId === version.id;

                    return (
                      <div key={version.id} className={`admin-questionnaire-version ${isCurrent ? "current" : ""}`}>
                        <div>
                          <strong>Версия {version.version}</strong>
                          <span>{formatDateTime(version.importedAt)}</span>
                        </div>
                        <div className="admin-questionnaire-version-badges">
                          {isCurrent && <span className="status-badge status-active">Сейчас у операторов</span>}
                          {version.published && <span className="status-badge">Опубликована</span>}
                        </div>
                        <div className="admin-questionnaire-version-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isCurrent || isPublishing || isDeleting}
                            onClick={() => void publishVersion(questionnaire.id, version.id)}
                          >
                            {isPublishing ? "Публикуем..." : isCurrent ? "Уже выбрана" : "Опубликовать"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button danger-soft-button"
                            disabled={isDeleting || isPublishing}
                            onClick={() =>
                              void deleteVersion(questionnaire, version.id, version.version, isCurrent)
                            }
                          >
                            {isDeleting ? "Удаляем..." : "Удалить"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {questionnaire.versions.length > 3 && (
                    <button
                      type="button"
                      className="secondary-button admin-questionnaire-versions-toggle"
                      onClick={() =>
                        setExpandedVersionsById((current) => ({
                          ...current,
                          [questionnaire.id]: !isVersionsExpanded,
                        }))
                      }
                    >
                      {isVersionsExpanded ? "Свернуть версии" : `Показать все версии (${questionnaire.versions.length})`}
                    </button>
                  )}
                </div>
              </article>
              );
            })}
          </div>
          <Pagination
            label="сценариев"
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

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "дата не указана";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
