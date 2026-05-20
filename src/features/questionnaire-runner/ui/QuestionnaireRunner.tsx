import { useEffect, useMemo, useReducer, useState } from "react";
import {
  getMainFlowQuestions,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  Questionnaire,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";
import {
  clearRunnerDraft,
  createRunnerStateFromDraft,
  getRunnerDraftSavedAt,
  hasDraftContent,
  saveRunnerDraft,
} from "../lib/draftStorage";
import {
  createInitialRunnerState,
  runnerReducer,
} from "../model/reducer";
import { QuestionCard } from "./QuestionCard";
import { QuestionnaireMap } from "./QuestionnaireMap";
import { SummaryPage } from "./SummaryPage";

interface QuestionnaireRunnerProps {
  questionnaire: Questionnaire;
}

export function QuestionnaireRunner({ questionnaire }: QuestionnaireRunnerProps) {
  const [restoredDraftSavedAt] = useState(() => getRunnerDraftSavedAt(questionnaire));
  const [lastSavedAt, setLastSavedAt] = useState(restoredDraftSavedAt);
  const [state, dispatch] = useReducer(
    runnerReducer,
    questionnaire,
    (initialQuestionnaire) => (
      createRunnerStateFromDraft(initialQuestionnaire) ?? createInitialRunnerState(initialQuestionnaire)
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
