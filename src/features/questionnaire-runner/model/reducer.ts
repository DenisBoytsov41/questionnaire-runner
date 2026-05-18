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
  messages: string[];
  verdicts: string[];
  isFinished: boolean;
  validationError: string;
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

    const messages = [...state.messages];
    const verdicts = [...state.verdicts];

    if (transition.message.trim()) {
      messages.push(transition.message.trim());
    }

    if (transition.verdict.trim()) {
      verdicts.push(transition.verdict.trim());
    }

    return {
      ...state,
      answers: {
        ...state.answers,
        [currentQuestion.id]: answer,
      },
      history: [...state.history, currentQuestion.id],
      currentQuestion: transition.nextQuestion,
      isFinished: transition.isFinished || transition.nextQuestion === null,
      messages,
      verdicts,
      validationError: "",
    };
  }

  return state;
}