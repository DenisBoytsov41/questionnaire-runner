import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  formatAnswerForSummary,
  getMainFlowQuestions,
  getQuestionById,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  Questionnaire,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";
import {
  finishQuestionnaireRun,
  saveQuestionnaireRunDraft,
  type QuestionnaireRun,
  type QuestionnaireRunPayload,
} from "../../../shared/api/backendApi";
import {
  clearRunnerDraft,
  createRunnerStateFromDraft,
  getRunnerDraftSavedAt,
  hasDraftContent,
  saveRunnerDraft,
} from "../lib/draftStorage";
import {
  createInitialRunnerState,
  createRunnerStateFromSnapshot,
  runnerReducer,
} from "../model/reducer";
import { QuestionCard } from "./QuestionCard";
import { QuestionnaireMap } from "./QuestionnaireMap";
import { SummaryPage } from "./SummaryPage";

interface QuestionnaireRunnerProps {
  questionnaire: Questionnaire;
  backendRun?: QuestionnaireRunPersistence;
}

export interface QuestionnaireRunPersistence {
  token: string;
  runId: string;
  initialRun?: QuestionnaireRun;
}

type ServerSaveStatus = "idle" | "saving" | "saved" | "error";

export function QuestionnaireRunner({ questionnaire, backendRun }: QuestionnaireRunnerProps) {
  const [restoredDraftSavedAt] = useState(() =>
    backendRun?.initialRun?.updatedAt ?? getRunnerDraftSavedAt(questionnaire),
  );
  const [lastSavedAt, setLastSavedAt] = useState(restoredDraftSavedAt);
  const [serverSavedAt, setServerSavedAt] = useState("");
  const [serverSaveStatus, setServerSaveStatus] = useState<ServerSaveStatus>("idle");
  const finishedRunIdsRef = useRef(new Set<string>());
  const backendRunId = backendRun?.runId;
  const backendToken = backendRun?.token;
  const [state, dispatch] = useReducer(
    runnerReducer,
    questionnaire,
    (initialQuestionnaire) => (
      backendRun?.initialRun
        ? createRunnerStateFromSnapshot(initialQuestionnaire, {
            currentQuestionId: backendRun.initialRun.currentQuestionId,
            answers: backendRun.initialRun.answers,
            history: backendRun.initialRun.route,
            messages: backendRun.initialRun.messages,
            verdicts: backendRun.initialRun.verdicts,
            startedAt: backendRun.initialRun.startedAt,
            finishedAt: backendRun.initialRun.finishedAt,
            isFinished: backendRun.initialRun.status === "finished",
          }) ?? createInitialRunnerState(initialQuestionnaire)
        : createRunnerStateFromDraft(initialQuestionnaire) ?? createInitialRunnerState(initialQuestionnaire)
    ),
  );

  const mainQuestions = useMemo(
    () => getMainFlowQuestions(questionnaire),
    [questionnaire],
  );

  const currentQuestionNumber = state.currentQuestion
    ? mainQuestions.findIndex((question) => question.id === state.currentQuestion?.id) + 1
    : mainQuestions.length;
  const isBranchQuestion = currentQuestionNumber <= 0;

  useEffect(() => {
    let timeoutId = 0;

    if (!hasDraftContent(state)) {
      clearRunnerDraft(questionnaire);
      timeoutId = window.setTimeout(() => setLastSavedAt(""), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const savedAt = saveRunnerDraft(state);
    timeoutId = window.setTimeout(() => setLastSavedAt(savedAt), 0);

    return () => window.clearTimeout(timeoutId);
  }, [questionnaire, state]);

  useEffect(() => {
    if (!backendRunId || !backendToken || !hasDraftContent(state)) {
      return;
    }

    if (state.isFinished && finishedRunIdsRef.current.has(backendRunId)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const payload = buildRunPayload(state);

      setServerSaveStatus("saving");

      const request = state.isFinished
        ? finishQuestionnaireRun(backendToken, backendRunId, payload)
        : saveQuestionnaireRunDraft(backendToken, backendRunId, payload);

      request
        .then((run) => {
          if (state.isFinished) {
            finishedRunIdsRef.current.add(backendRunId);
          }

          setServerSavedAt(run.updatedAt);
          setServerSaveStatus("saved");
        })
        .catch(() => {
          setServerSaveStatus("error");
        });
    }, state.isFinished ? 0 : 700);

    return () => window.clearTimeout(timeoutId);
  }, [backendRunId, backendToken, state]);

  function handleRestart() {
    clearRunnerDraft(questionnaire);
    setLastSavedAt("");
    dispatch({ type: "RESET" });
  }

  if (state.isFinished || !state.currentQuestion) {
    return (
      <SummaryPage
        questionnaire={questionnaire}
        answers={state.answers}
        messages={state.messages.map((message) => message.text)}
        verdicts={state.verdicts.map((verdict) => verdict.text)}
        route={state.history}
        startedAt={state.startedAt}
        finishedAt={state.finishedAt}
        onRestart={handleRestart}
      />
    );
  }

  const section = getSectionById(questionnaire, state.currentQuestion.section_id);

  function handleAnswer(answer: QuestionAnswer) {
    dispatch({
      type: "ANSWER_CURRENT",
      payload: {
        answer,
      },
    });
  }

  return (
    <div className="runner-layout">
      <main className="runner-page">
        <section className="runner-header" aria-labelledby="runner-title">
          <p className="page-kicker">Рабочий опросник</p>
          <h1 id="runner-title">{questionnaire.title}</h1>
          <p>{questionnaire.start_text}</p>
        </section>

        {section && (
          <section className="section-banner" aria-label="Текущий раздел">
            <strong>{section.title}</strong>
            {section.description && <span>{section.description}</span>}
          </section>
        )}

        <QuestionCard
          key={state.currentQuestion.id}
          question={state.currentQuestion}
          questionNumber={currentQuestionNumber}
          totalQuestions={mainQuestions.length}
          isBranchQuestion={isBranchQuestion}
          initialAnswer={state.answers[state.currentQuestion.id]}
          validationError={state.validationError}
          canGoBack={state.history.length > 0}
          onAnswer={handleAnswer}
          onBack={() => dispatch({ type: "BACK" })}
          onFinish={() => dispatch({ type: "FINISH" })}
        />
      </main>

      <aside className="runner-side-panel" aria-label="Навигация по опроснику">
        <QuestionnaireMap
          questionnaire={questionnaire}
          currentQuestionId={state.currentQuestion.id}
          completedRoute={state.history}
          totalQuestions={mainQuestions.length}
          answeredCount={Object.keys(state.answers).length}
          startedAt={state.startedAt}
          draftSavedAt={lastSavedAt}
          serverSaveStatus={backendRun ? serverSaveStatus : undefined}
          serverSavedAt={serverSavedAt}
          onBack={() => dispatch({ type: "BACK" })}
          onClearDraft={handleRestart}
          onNavigateToQuestion={(questionId) => {
            dispatch({
              type: "NAVIGATE_TO_ROUTE",
              payload: {
                questionId,
              },
            });
          }}
        />
      </aside>
    </div>
  );
}

function buildRunPayload(state: ReturnType<typeof createInitialRunnerState>): QuestionnaireRunPayload {
  return {
    currentQuestionId: state.currentQuestion?.id ?? null,
    answers: state.answers,
    route: state.history,
    messages: state.messages.map((message) => message.text),
    verdicts: state.verdicts.map((verdict) => verdict.text),
    summaryText: buildSummaryTextForBackend(state),
  };
}

function buildSummaryTextForBackend(state: ReturnType<typeof createInitialRunnerState>): string {
  const lines = [`Итог обращения: ${state.questionnaire.title}`, ""];

  if (state.messages.length > 0) {
    lines.push("Что нужно учесть:");
    state.messages.forEach((message) => lines.push(`- ${message.text}`));
    lines.push("");
  }

  if (state.verdicts.length > 0) {
    lines.push("Итоговые действия:");
    state.verdicts.forEach((verdict) => lines.push(`- ${verdict.text}`));
    lines.push("");
  }

  lines.push("Ответы по пройденному маршруту:");
  state.history.forEach((questionId) => {
    const question = getQuestionById(state.questionnaire, questionId);

    if (!question || !Object.prototype.hasOwnProperty.call(state.answers, question.id)) {
      return;
    }

    lines.push(`- ${question.title}: ${formatAnswerForSummary(question, state.answers[question.id])}`);
  });

  return lines.join("\n");
}
