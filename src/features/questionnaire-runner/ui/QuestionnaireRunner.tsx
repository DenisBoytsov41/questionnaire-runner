import { useMemo, useReducer } from "react";
import {
  getMainFlowQuestions,
  getSectionById,
} from "../../../entities/questionnaire/helpers";
import type {
  Questionnaire,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";
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
  const [state, dispatch] = useReducer(
    runnerReducer,
    questionnaire,
    createInitialRunnerState,
  );

  const mainQuestions = useMemo(
    () => getMainFlowQuestions(questionnaire),
    [questionnaire],
  );

  const currentQuestionNumber = state.currentQuestion
    ? mainQuestions.findIndex((question) => question.id === state.currentQuestion?.id) + 1
    : mainQuestions.length;
  const isBranchQuestion = currentQuestionNumber <= 0;

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
        onRestart={() => dispatch({ type: "RESET" })}
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
          <p className="page-kicker">Интерактивный опросник</p>
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
          onBack={() => dispatch({ type: "BACK" })}
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
