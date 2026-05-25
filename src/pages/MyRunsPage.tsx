import { useMemo, useState } from "react";
import type {
  CurrentUser,
  ListPageParams,
  PaginationMeta,
  PublishedQuestionnaire,
  QuestionnaireRun,
  UserPreferences,
} from "../shared/api/backendApi";
import { BrandHeader, type HeaderNavigationItem, type SettingsStatus } from "../shared/ui/BrandHeader";
import { Pagination } from "../shared/ui/Pagination";

interface MyRunsPageProps {
  runs: QuestionnaireRun[];
  questionnaires: PublishedQuestionnaire[];
  pagination: PaginationMeta;
  params: Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "status">>;
  status: "loading" | "ready" | "error";
  error: string;
  onRefresh: () => void;
  onParamsChange: (params: Partial<Required<Pick<ListPageParams, "page" | "pageSize" | "search" | "status">>>) => void;
  onContinueRun: (run: QuestionnaireRun) => void;
  onDeleteDraftRun: (run: QuestionnaireRun) => Promise<void>;
  onBackToCatalog: () => void;
  navigationItems?: HeaderNavigationItem[];
  user: CurrentUser;
  settings: UserPreferences;
  settingsStatus: SettingsStatus;
  onSettingsChange: (settings: UserPreferences) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function MyRunsPage({
  runs,
  questionnaires,
  pagination,
  params,
  status,
  error,
  onRefresh,
  onParamsChange,
  onContinueRun,
  onDeleteDraftRun,
  onBackToCatalog,
  navigationItems,
  user,
  settings,
  settingsStatus,
  onSettingsChange,
  onOpenProfile,
  onLogout,
}: MyRunsPageProps) {
  const [openedRunId, setOpenedRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState("");
  const [localError, setLocalError] = useState("");
  const [copyStatus, setCopyStatus] = useState<{ runId: string; message: string; type: "success" | "error" } | null>(
    null,
  );
  const questionnaireTitleById = useMemo(
    () => new Map(questionnaires.map((questionnaire) => [questionnaire.id, questionnaire.title])),
    [questionnaires],
  );
  const isLoading = status === "loading";

  return (
    <main className="app-shell">
      <BrandHeader
        subtitle="История прохождений"
        navigationItems={navigationItems}
        user={user}
        settings={settings}
        settingsStatus={settingsStatus}
        onSettingsChange={onSettingsChange}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />

      <section className="runs-page">
        <div className="runs-hero">
          <div>
            <p className="page-kicker">Работа оператора</p>
            <h1>Мои прохождения</h1>
            <p>
              Здесь собраны сохранённые черновики и завершённые опросы. Можно быстро проверить,
              что уже отправлено в базу, и повторно скопировать итог завершённого обращения.
            </p>
          </div>

          <div className="runs-hero-metrics">
            <RunMetric label="Всего" value={pagination.totalItems} />
            <RunMetric label="Черновики" value={runs.filter((run) => run.status === "draft").length} />
            <RunMetric label="Завершено" value={runs.filter((run) => run.status === "finished").length} />
          </div>
        </div>

        <div className="runs-toolbar">
          <label className="runs-search">
            <span>Найти прохождение</span>
            <input
              type="search"
              value={params.search}
              onChange={(event) => onParamsChange({ search: event.target.value })}
              placeholder="Название сценария, код или текст итога"
            />
          </label>

          <div className="runs-filter-group" aria-label="Фильтр прохождений">
            <button
              type="button"
              className={params.status === "all" ? "active" : ""}
              onClick={() => onParamsChange({ status: "all" })}
            >
              Все
            </button>
            <button
              type="button"
              className={params.status === "draft" ? "active" : ""}
              onClick={() => onParamsChange({ status: "draft" })}
            >
              Черновики
            </button>
            <button
              type="button"
              className={params.status === "finished" ? "active" : ""}
              onClick={() => onParamsChange({ status: "finished" })}
            >
              Завершённые
            </button>
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

        {isLoading && runs.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Загрузка</p>
            <h2>Получаем историю</h2>
            <p>Проверяем сохранённые прохождения в базе данных.</p>
          </div>
        )}

        {!isLoading && runs.length === 0 && (
          <div className="runs-empty-card">
            <p className="page-kicker">Пока пусто</p>
            <h2>Подходящих прохождений нет</h2>
            <p>Запустите сценарий из списка, ответьте на вопросы, и прохождение появится здесь.</p>
            <button type="button" className="primary-button" onClick={onBackToCatalog}>
              Перейти к сценариям
            </button>
          </div>
        )}

        {runs.length > 0 && (
          <>
            <div className="runs-list">
              {runs.map((run) => {
              const title = questionnaireTitleById.get(run.questionnaireId) ?? run.questionnaireId;
              const isOpened = openedRunId === run.id;

              return (
                <article key={run.id} className={`run-card ${run.status}`}>
                  <div className="run-card-main">
                    <div>
                      <span className={`run-status ${run.status}`}>
                        {run.status === "finished" ? "Завершено" : "Черновик"}
                      </span>
                      <h2>{title}</h2>
                      <p>
                        Ответов: {Object.keys(run.answers).length}. Маршрут: {run.route.length} шагов.
                      </p>
                    </div>

                    <dl className="run-card-dates">
                      <div>
                        <dt>Начато</dt>
                        <dd>{formatDateTime(run.startedAt)}</dd>
                      </div>
                      <div>
                        <dt>Обновлено</dt>
                        <dd>{formatDateTime(run.updatedAt)}</dd>
                      </div>
                      <div>
                        <dt>Завершено</dt>
                        <dd>{run.finishedAt ? formatDateTime(run.finishedAt) : "пока нет"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="run-card-actions">
                    {run.status === "draft" && (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => onContinueRun(run)}
                      >
                        Продолжить черновик
                      </button>
                    )}

                    {run.status === "draft" && (
                      <button
                        type="button"
                        className="secondary-button danger-soft-button"
                        disabled={deletingRunId === run.id}
                        onClick={async () => {
                          setDeletingRunId(run.id);
                          setLocalError("");

                          try {
                            await onDeleteDraftRun(run);
                          } catch (deleteError) {
                            setLocalError(
                              deleteError instanceof Error ? deleteError.message : "Не удалось удалить черновик.",
                            );
                          } finally {
                            setDeletingRunId("");
                          }
                        }}
                      >
                        {deletingRunId === run.id ? "Удаляем..." : "Удалить черновик"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setOpenedRunId(isOpened ? null : run.id)}
                    >
                      {isOpened ? "Скрыть детали" : "Открыть детали"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!run.summaryText.trim()}
                      onClick={async () => {
                        const result = await copyRunSummary(run.summaryText);
                        setCopyStatus({
                          runId: run.id,
                          message: result,
                          type: result === "Итог скопирован." ? "success" : "error",
                        });
                      }}
                    >
                      Скопировать итог
                    </button>

                    {copyStatus?.runId === run.id && (
                      <span className={`run-copy-status ${copyStatus.type}`}>{copyStatus.message}</span>
                    )}
                  </div>

                  {isOpened && (
                    <div className="run-details">
                      <div>
                        <p className="page-kicker">Данные прохождения</p>
                        <dl className="run-details-grid">
                          <div>
                            <dt>Код прохождения</dt>
                            <dd>{run.id}</dd>
                          </div>
                          <div>
                            <dt>Код сценария</dt>
                            <dd>{run.questionnaireId}</dd>
                          </div>
                          <div>
                            <dt>Текущий вопрос</dt>
                            <dd>{run.currentQuestionId ?? "опрос завершён"}</dd>
                          </div>
                        </dl>
                      </div>

                      <div>
                        <p className="page-kicker">Текст результата</p>
                        <pre>{run.summaryText.trim() || "Итог ещё не сформирован."}</pre>
                      </div>
                    </div>
                  )}
                </article>
              );
              })}
            </div>
            <Pagination
              label="прохождений"
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

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function copyRunSummary(summaryText: string): Promise<string> {
  if (!summaryText.trim()) {
    return "Итог пока пустой.";
  }

  try {
    await navigator.clipboard.writeText(summaryText);
    return "Итог скопирован.";
  } catch {
    return "Не удалось скопировать итог.";
  }
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
