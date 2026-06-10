import { getFirstActiveQuestion, isAnswerEmpty } from "../../../entities/questionnaire/helpers";
import type {
  AnswersMap,
  Questionnaire,
  QuestionnaireQuestion,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";
import { getTransitionResult } from "./transitionEngine";

export interface RunnerState {
  questionnaire: Questionnaire;
  currentQuestion: QuestionnaireQuestion | null;
  answers: AnswersMap;
  history: string[];
  messages: AppliedRunnerText[];
  verdicts: AppliedRunnerText[];
  isFinished: boolean;
  validationError: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface AppliedRunnerText {
  questionId: string;
  text: string;
}

export type RunnerAction =
  | {
      type: "ANSWER_CURRENT";
      payload: {
        answer: QuestionAnswer;
      };
    }
  | {
      type: "BACK";
    }
  | {
      type: "NAVIGATE_TO_ROUTE";
      payload: {
        questionId: string;
      };
    }
  | {
      type: "RESET";
    }
  | {
      type: "FINISH";
    };

export function createInitialRunnerState(questionnaire: Questionnaire): RunnerState {
  return {
    questionnaire,
    currentQuestion: getFirstActiveQuestion(questionnaire),
    answers: {},
    history: [],
    messages: [],
    verdicts: [],
    isFinished: false,
    validationError: "",
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

export function createRunnerStateFromSnapshot(
  questionnaire: Questionnaire,
  snapshot: {
    currentQuestionId: string | null;
    answers: AnswersMap;
    history: string[];
    messages: string[];
    verdicts: string[];
    startedAt: string;
    finishedAt: string | null;
    isFinished: boolean;
  },
): RunnerState | null {
  const currentQuestion = snapshot.currentQuestionId
    ? questionnaire.questions.find((question) => question.id === snapshot.currentQuestionId) ?? null
    : null;

  if (!snapshot.isFinished && !currentQuestion) {
    return null;
  }

  const fallbackQuestionId = snapshot.currentQuestionId ?? snapshot.history.at(-1) ?? "";

  return {
    questionnaire,
    currentQuestion,
    answers: snapshot.answers,
    history: snapshot.history,
    messages: snapshot.messages.map((text) => ({
      questionId: fallbackQuestionId,
      text,
    })),
    verdicts: snapshot.verdicts.map((text) => ({
      questionId: fallbackQuestionId,
      text,
    })),
    isFinished: snapshot.isFinished,
    validationError: "",
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
  };
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  if (action.type === "RESET") {
    return createInitialRunnerState(state.questionnaire);
  }

  if (action.type === "FINISH") {
    const currentQuestionId = state.currentQuestion?.id;
    const shouldIncludeCurrentQuestion = Boolean(
      currentQuestionId
      && !state.history.includes(currentQuestionId)
      && Object.prototype.hasOwnProperty.call(state.answers, currentQuestionId),
    );

    return {
      ...state,
      history: shouldIncludeCurrentQuestion && currentQuestionId
        ? [...state.history, currentQuestionId]
        : state.history,
      isFinished: true,
      currentQuestion: null,
      validationError: "",
      finishedAt: new Date().toISOString(),
    };
  }

  if (action.type === "BACK") {
    const currentQuestionIndex = state.currentQuestion
      ? state.history.indexOf(state.currentQuestion.id)
      : -1;
    const previousQuestionId = currentQuestionIndex >= 0
      ? state.history[currentQuestionIndex - 1]
      : state.history[state.history.length - 1];

    if (!previousQuestionId) {
      return state;
    }

    const previousQuestion = state.questionnaire.questions.find(
      (question) => question.id === previousQuestionId,
    );

    if (!previousQuestion) {
      return state;
    }

    return {
      ...state,
      currentQuestion: previousQuestion,
      isFinished: false,
      validationError: "",
      finishedAt: null,
    };
  }

  if (action.type === "NAVIGATE_TO_ROUTE") {
    const targetIndex = state.history.indexOf(action.payload.questionId);

    if (targetIndex < 0) {
      return state;
    }

    const currentQuestion = state.questionnaire.questions.find(
      (question) => question.id === action.payload.questionId,
    );

    if (!currentQuestion) {
      return state;
    }

    return {
      ...state,
      currentQuestion,
      isFinished: false,
      validationError: "",
      finishedAt: null,
    };
  }

  if (action.type === "ANSWER_CURRENT") {
    const currentQuestion = state.currentQuestion;

    if (!currentQuestion) {
      return state;
    }

    const answer = action.payload.answer;

    if (currentQuestion.required && isAnswerEmpty(answer)) {
      return {
        ...state,
        validationError: "Ответ на этот вопрос обязателен.",
      };
    }

    const transition = getTransitionResult(
      state.questionnaire,
      currentQuestion,
      answer,
    );

    const currentRouteIndex = state.history.indexOf(currentQuestion.id);
    const routeThroughCurrent = currentRouteIndex >= 0
      ? state.history.slice(0, currentRouteIndex + 1)
      : [...state.history, currentQuestion.id];
    const existingNextQuestionId = currentRouteIndex >= 0
      ? state.history[currentRouteIndex + 1]
      : undefined;
    const nextQuestionId = transition.nextQuestion?.id;
    const continuesAlongExistingRoute = Boolean(
      nextQuestionId && existingNextQuestionId === nextQuestionId,
    );
    const actualRouteIds = continuesAlongExistingRoute
      ? state.history
      : routeThroughCurrent;
    const actualRouteIdSet = new Set(actualRouteIds);
    const answers = {
      ...state.answers,
      [currentQuestion.id]: answer,
    };
    const messages = state.messages.filter(
      (item) => actualRouteIdSet.has(item.questionId) && item.questionId !== currentQuestion.id,
    );
    const verdicts = state.verdicts.filter(
      (item) => actualRouteIdSet.has(item.questionId) && item.questionId !== currentQuestion.id,
    );

    if (transition.message.trim()) {
      messages.push({
        questionId: currentQuestion.id,
        text: transition.message.trim(),
      });
    }

    if (transition.verdict.trim()) {
      verdicts.push({
        questionId: currentQuestion.id,
        text: transition.verdict.trim(),
      });
    }

    return {
      ...state,
      answers,
      history: actualRouteIds,
      currentQuestion: transition.nextQuestion,
      isFinished: transition.isFinished || transition.nextQuestion === null,
      messages,
      verdicts,
      validationError: "",
      finishedAt: transition.isFinished || transition.nextQuestion === null
        ? new Date().toISOString()
        : null,
    };
  }

  return state;
}
