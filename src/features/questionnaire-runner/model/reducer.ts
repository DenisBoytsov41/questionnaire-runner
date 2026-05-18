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

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  if (action.type === "RESET") {
    return createInitialRunnerState(state.questionnaire);
  }

  if (action.type === "FINISH") {
    return {
      ...state,
      isFinished: true,
      currentQuestion: null,
      validationError: "",
      finishedAt: new Date().toISOString(),
    };
  }

  if (action.type === "BACK") {
    const previousQuestionId = state.history[state.history.length - 1];

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
      history: state.history.slice(0, -1),
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

    const retainedQuestionIds = state.history.slice(0, targetIndex + 1);
    const completedBeforeTargetIds = state.history.slice(0, targetIndex);
    const completedBeforeTargetIdSet = new Set(completedBeforeTargetIds);
    const answers = retainedQuestionIds.reduce<AnswersMap>((result, questionId) => {
      if (Object.prototype.hasOwnProperty.call(state.answers, questionId)) {
        result[questionId] = state.answers[questionId];
      }

      return result;
    }, {});

    return {
      ...state,
      currentQuestion,
      answers,
      history: state.history.slice(0, targetIndex),
      messages: state.messages.filter((item) => completedBeforeTargetIdSet.has(item.questionId)),
      verdicts: state.verdicts.filter((item) => completedBeforeTargetIdSet.has(item.questionId)),
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

    const actualRouteIds = [...state.history, currentQuestion.id];
    const actualRouteIdSet = new Set(actualRouteIds);
    const answers = actualRouteIds.reduce<AnswersMap>((result, questionId) => {
      if (questionId === currentQuestion.id) {
        result[questionId] = answer;
        return result;
      }

      if (Object.prototype.hasOwnProperty.call(state.answers, questionId)) {
        result[questionId] = state.answers[questionId];
      }

      return result;
    }, {});

    const messages = state.messages.filter((item) => actualRouteIdSet.has(item.questionId));
    const verdicts = state.verdicts.filter((item) => actualRouteIdSet.has(item.questionId));

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
