import { useMemo, useState } from "react";
import {
  getActiveQuestions,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  Questionnaire,
  QuestionnaireQuestion,
} from "../../../entities/questionnaire/types";

interface QuestionnaireMapProps {
  questionnaire: Questionnaire;
  currentQuestionId: string;
  completedRoute: string[];
  totalQuestions: number;
  answeredCount: number;
  startedAt: string;
  draftSavedAt: string;
  onBack: () => void;
  onClearDraft: () => void;
  onNavigateToQuestion: (questionId: string) => void;
}

export function QuestionnaireMap({
  questionnaire,
  currentQuestionId,
  completedRoute,
  totalQuestions,
  answeredCount,
  startedAt,
  draftSavedAt,
  onBack,
  onClearDraft,
  onNavigateToQuestion,
}: QuestionnaireMapProps) {
  const [questionSearch, setQuestionSearch] = useState("");
  const completedQuestionIds = new Set(completedRoute);
  const routeQuestionIds = new Set([...completedRoute, currentQuestionId]);
  const activeQuestions = useMemo(() => getActiveQuestions(questionnaire), [questionnaire]);
  const groupedQuestions = useMemo(
    () => groupQuestionsBySection(questionnaire, activeQuestions),
    [activeQuestions, questionnaire],
  );
  const scenarioCheck = useMemo(
    () => buildScenarioCheck(questionnaire, activeQuestions),
    [activeQuestions, questionnaire],
  );
  const flowPreviewByQuestionId = useMemo(
    () => buildFlowPreviewByQuestionId(questionnaire, activeQuestions),
    [activeQuestions, questionnaire],
  );
  const filteredGroups = useMemo(
    () => filterQuestionGroups(groupedQuestions, questionSearch),
    [groupedQuestions, questionSearch],
  );
  const currentQuestion = questionnaire.questions.find((question) => question.id === currentQuestionId);
  const currentStep = Math.min(completedRoute.length + 1, totalQuestions);
  const progressValue = totalQuestions > 0 ? Math.round((currentStep / totalQuestions) * 100) : 0;

  return (
    <div className="runner-navigator">
      <section className="navigator-panel route-panel" aria-label="Маршрут прохождения">
        <div className="route-card-header">
          <div>
            <span className="panel-kicker">Маршрут</span>
            <strong>{currentStep} из {totalQuestions}</strong>
          </div>
          <span className="route-progress-percent">{progressValue}%</span>
        </div>

        <div className="route-progress-track" aria-hidden="true">
          <span style={{ width: `${progressValue}%` }} />
        </div>

        <p className="route-current-question">{currentQuestion?.title}</p>

        <button
          type="button"
          className="secondary-button route-back-button"
          disabled={completedRoute.length === 0}
          onClick={onBack}
        >
          Назад к предыдущему вопросу
        </button>
      </section>

      <section className="navigator-panel draft-status-card" aria-label="Состояние черновика">
        <div>
          <span className="panel-kicker">Состояние</span>
          <strong>{draftSavedAt ? "Черновик сохранён" : "Новый опрос"}</strong>
        </div>

        <dl className="draft-status-grid">
          <div>
            <dt>Начало</dt>
            <dd>{formatTime(startedAt)}</dd>
          </div>
          <div>
            <dt>Сохранено</dt>
            <dd>{draftSavedAt ? formatTime(draftSavedAt) : "пока нет"}</dd>
          </div>
          <div>
            <dt>Ответов</dt>
            <dd>{answeredCount}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="secondary-button draft-clear-button"
          disabled={!draftSavedAt && answeredCount === 0}
          onClick={onClearDraft}
        >
          Очистить и начать заново
        </button>
      </section>

      <section className="navigator-panel scenario-check-card" aria-label="Проверка сценария">
        <div className="scenario-check-header">
          <div>
            <span className="panel-kicker">Проверка сценария</span>
            <strong>{scenarioCheck.warnings.length === 0 ? "Замечаний нет" : "Нужна проверка"}</strong>
          </div>
          <span className={scenarioCheck.warnings.length === 0 ? "scenario-status good" : "scenario-status warn"}>
            {scenarioCheck.warnings.length === 0 ? "Готов" : scenarioCheck.warnings.length}
          </span>
        </div>

        <dl className="scenario-metrics">
          <div>
            <dt>Вопросов</dt>
            <dd>{scenarioCheck.questionCount}</dd>
          </div>
          <div>
            <dt>Переходов</dt>
            <dd>{scenarioCheck.ruleCount}</dd>
          </div>
          <div>
            <dt>Веток</dt>
            <dd>{scenarioCheck.branchCount}</dd>
          </div>
        </dl>

        {scenarioCheck.warnings.length > 0 && (
          <ul className="scenario-warning-list">
            {scenarioCheck.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </section>

      <details className="navigator-panel map-card">
        <summary>Схема вопросов</summary>

        <div className="question-map-tools">
          <label htmlFor="question-map-search">Найти вопрос</label>
          <input
            id="question-map-search"
            className="question-search-input"
            type="search"
            value={questionSearch}
            onChange={(event) => setQuestionSearch(event.target.value)}
            placeholder="Введите часть вопроса или раздела"
          />
          <span>
            {questionSearch.trim()
              ? `Найдено: ${countQuestions(filteredGroups)}`
              : `Всего вопросов: ${activeQuestions.length}`}
          </span>
        </div>

        <div className="question-map" id="question-map">
          {filteredGroups.length === 0 && (
            <p className="question-map-empty">По такому запросу вопросов не найдено.</p>
          )}

          {filteredGroups.map((group) => (
            <section key={group.sectionTitle} className="question-map-section">
              <h3>{group.sectionTitle}</h3>

              {group.questions.map((question) => {
                const isCurrent = question.id === currentQuestionId;
                const isCompleted = completedQuestionIds.has(question.id);
                const isInRoute = routeQuestionIds.has(question.id);
                const flowPreview = flowPreviewByQuestionId.get(question.id) ?? [];

                return (
                  <article
                    key={question.id}
                    className={[
                      "question-map-item",
                      isCurrent ? "current" : "",
                      isCompleted ? "completed" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      disabled={!isCompleted || isCurrent}
                      onClick={() => onNavigateToQuestion(question.id)}
                    >
                      <span>{isCurrent ? "Сейчас" : isCompleted ? "Пройден" : isInRoute ? "В маршруте" : "Не пройден"}</span>
                      <strong>{question.title}</strong>
                    </button>

                    {flowPreview.length > 0 && (
                      <div className="question-rule-list">
                        {flowPreview.map((rule) => (
                          <small key={`${question.id}-${rule.condition}-${rule.target}`}>
                            <span>{rule.condition}</span>
                            <strong>{rule.target}</strong>
                            {rule.note && <em>{rule.note}</em>}
                          </small>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface QuestionGroup {
  sectionTitle: string;
  questions: QuestionnaireQuestion[];
}

interface ScenarioCheck {
  questionCount: number;
  ruleCount: number;
  branchCount: number;
  warnings: string[];
}

interface FlowPreviewItem {
  condition: string;
  target: string;
  note: string;
}

function groupQuestionsBySection(
  questionnaire: Questionnaire,
  questions: QuestionnaireQuestion[],
): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();

  questions.forEach((question) => {
    const section = getSectionById(questionnaire, question.section_id);
    const sectionTitle = section?.title ?? "Без раздела";
    const group = groups.get(sectionTitle) ?? {
      sectionTitle,
      questions: [],
    };

    group.questions.push(question);
    groups.set(sectionTitle, group);
  });

  return Array.from(groups.values());
}

function filterQuestionGroups(groups: QuestionGroup[], searchText: string): QuestionGroup[] {
  const normalizedSearch = searchText.trim().toLowerCase();

  if (!normalizedSearch) {
    return groups;
  }

  return groups
    .map((group) => {
      const sectionMatches = group.sectionTitle.toLowerCase().includes(normalizedSearch);
      const questions = sectionMatches
        ? group.questions
        : group.questions.filter((question) => question.title.toLowerCase().includes(normalizedSearch));

      return {
        ...group,
        questions,
      };
    })
    .filter((group) => group.questions.length > 0);
}

function countQuestions(groups: QuestionGroup[]): number {
  return groups.reduce((sum, group) => sum + group.questions.length, 0);
}

function buildFlowPreviewByQuestionId(
  questionnaire: Questionnaire,
  activeQuestions: QuestionnaireQuestion[],
): Map<string, FlowPreviewItem[]> {
  const result = new Map<string, FlowPreviewItem[]>();
  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
  const nextQuestionById = getNextQuestionById(activeQuestions);

  activeQuestions.forEach((question) => {
    const rules = question.rules ?? [];
    const previewItems = rules.map((rule) => ({
      condition: formatRuleValue(rule.value),
      target: formatRuleTarget(questionnaire, rule.question_id, rule.action),
      note: formatRuleNote(rule.message, rule.verdict),
    }));

    if (rules.length === 0) {
      previewItems.push({
        condition: "Любой ответ",
        target: nextQuestionById.get(question.id)
          ? formatRuleTarget(questionnaire, nextQuestionById.get(question.id) ?? null, "go_to_question")
          : "завершить",
        note: "обычный порядок",
      });
    } else {
      const hasNextRule = rules.some((rule) => rule.action === "next");

      if (!hasNextRule && nextQuestionById.get(question.id) && activeQuestionIds.has(nextQuestionById.get(question.id) ?? "")) {
        previewItems.push({
          condition: "Если нет отдельного правила",
          target: formatRuleTarget(questionnaire, nextQuestionById.get(question.id) ?? null, "go_to_question"),
          note: "обычный порядок",
        });
      }
    }

    result.set(question.id, previewItems);
  });

  return result;
}

function buildScenarioCheck(
  questionnaire: Questionnaire,
  activeQuestions: QuestionnaireQuestion[],
): ScenarioCheck {
  const questionIds = new Set(activeQuestions.map((question) => question.id));
  const warnings: string[] = [];
  const allRules = activeQuestions.flatMap((question) => question.rules ?? []);
  const branchRules = allRules.filter((rule) => rule.action === "go_to_question");
  const brokenRules = branchRules.filter((rule) => !rule.question_id || !questionIds.has(rule.question_id));
  const unreachableQuestions = getUnreachableQuestions(activeQuestions);

  if (activeQuestions.length === 0) {
    warnings.push("В сценарии нет активных вопросов.");
  }

  brokenRules.slice(0, 3).forEach((rule) => {
    warnings.push(`Есть переход к несуществующему вопросу: ${rule.question_id || "код не указан"}.`);
  });

  if (brokenRules.length > 3) {
    warnings.push(`Ещё переходов с ошибками: ${brokenRules.length - 3}.`);
  }

  if (unreachableQuestions.length > 0) {
    warnings.push(`Есть вопросы вне маршрута: ${unreachableQuestions.length}.`);
  }

  if (questionnaire.sections.length === 0) {
    warnings.push("В сценарии нет разделов.");
  }

  return {
    questionCount: activeQuestions.length,
    ruleCount: allRules.length,
    branchCount: branchRules.length,
    warnings,
  };
}

function getUnreachableQuestions(activeQuestions: QuestionnaireQuestion[]): QuestionnaireQuestion[] {
  const firstQuestion = activeQuestions[0];

  if (!firstQuestion) {
    return [];
  }

  const questionsById = new Map(activeQuestions.map((question) => [question.id, question]));
  const nextQuestionById = getNextQuestionById(activeQuestions);

  const reachableIds = new Set<string>();
  const queue = [firstQuestion.id];

  while (queue.length > 0) {
    const questionId = queue.shift();

    if (!questionId || reachableIds.has(questionId)) {
      continue;
    }

    reachableIds.add(questionId);

    const question = questionsById.get(questionId);

    if (!question) {
      continue;
    }

    const nextQuestionId = nextQuestionById.get(question.id);

    if (nextQuestionId) {
      queue.push(nextQuestionId);
    }

    (question.rules ?? []).forEach((rule) => {
      if (rule.action === "go_to_question" && rule.question_id) {
        queue.push(rule.question_id);
      }
    });
  }

  return activeQuestions.filter((question) => !reachableIds.has(question.id));
}

function getNextQuestionById(activeQuestions: QuestionnaireQuestion[]): Map<string, string> {
  const nextQuestionById = new Map<string, string>();

  activeQuestions.forEach((question, index) => {
    const nextQuestion = activeQuestions[index + 1];

    if (nextQuestion) {
      nextQuestionById.set(question.id, nextQuestion.id);
    }
  });

  return nextQuestionById;
}

function formatRuleValue(value: string | boolean | number | null): string {
  if (value === true || value === "true") {
    return "Да";
  }

  if (value === false || value === "false") {
    return "Нет";
  }

  return value === null ? "Любой ответ" : String(value);
}

function formatRuleTarget(
  questionnaire: Questionnaire,
  questionId: string | null,
  action: string,
): string {
  if (action === "finish") {
    return "завершить";
  }

  if (action === "next") {
    return "следующий";
  }

  const question = questionId
    ? questionnaire.questions.find((item) => item.id === questionId)
    : null;

  return question?.title ?? questionId ?? "не задан";
}

function formatRuleNote(message: string | undefined, verdict: string | undefined): string {
  const notes = [message, verdict].filter((item): item is string => Boolean(item?.trim()));

  return notes.join("; ");
}
