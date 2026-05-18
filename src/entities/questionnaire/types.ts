import type {
  QuestionnaireAnswerType,
  QuestionnaireTransitionAction,
  QuestionnaireOption,
  QuestionnaireRule,
  QuestionnaireSection,
  QuestionnaireQuestion,
  Questionnaire,
  QuestionnaireBundle,
  QuestionnaireInput,
} from "./schema";

export type AnswerType = QuestionnaireAnswerType;
export type TransitionAction = QuestionnaireTransitionAction;

export type {
  QuestionnaireOption,
  QuestionnaireRule,
  QuestionnaireSection,
  QuestionnaireQuestion,
  Questionnaire,
  QuestionnaireBundle,
  QuestionnaireInput,
};

export type QuestionAnswer = string | string[] | boolean | number | null;

export type AnswersMap = Record<string, QuestionAnswer>;

export interface AppliedRuleResult {
  action: TransitionAction;
  questionId: string | null;
  message: string;
  verdict: string;
}