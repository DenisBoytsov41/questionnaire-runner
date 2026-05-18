export type AnswerType =
  | "string"
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "file";

export type TransitionAction = "next" | "go_to_question" | "finish";

export interface QuestionnaireSection {
  id: string;
  title: string;
  description: string;
  order: number;
  active: boolean;
  parent_id: string | null;
}

export interface QuestionnaireOption {
  value: string;
  title: string;
  order: number;
  active: boolean;
}

export interface QuestionnaireRule {
  value: string;
  action: TransitionAction;
  question_id: string | null;
  message: string;
  verdict: string;
}

export interface QuestionnaireQuestion {
  id: string;
  section_id: string | null;
  title: string;
  hint: string;
  answer_type: AnswerType;
  required: boolean;
  order: number;
  active: boolean;
  show_in_summary: boolean;
  options?: QuestionnaireOption[];
  rules?: QuestionnaireRule[];
}

export interface Questionnaire {
  schema: string;
  schema_version: number;
  id: string;
  title: string;
  description: string;
  active: boolean;
  order: number;
  start_text: string;
  finish_text: string;
  sections: QuestionnaireSection[];
  questions: QuestionnaireQuestion[];
}

export type QuestionAnswer = string | string[] | boolean | number | null;

export type AnswersMap = Record<string, QuestionAnswer>;

export interface AppliedRuleResult {
  action: TransitionAction;
  questionId: string | null;
  message: string;
  verdict: string;
}   