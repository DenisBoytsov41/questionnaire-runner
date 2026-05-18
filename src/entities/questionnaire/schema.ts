import { z } from "zod";

export const answerTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "file",
]);

export const transitionActionSchema = z.enum([
  "next",
  "go_to_question",
  "finish",
]);

export const questionnaireOptionSchema = z.object({
  value: z.string().min(1, "У варианта ответа не заполнено value"),
  title: z.string().min(1, "У варианта ответа не заполнено title"),
  order: z.number(),
  active: z.boolean(),
});

export const questionnaireRuleSchema = z.object({
  value: z.string().min(1, "У правила перехода не заполнено value"),
  action: transitionActionSchema,
  question_id: z.string().nullable(),
  message: z.string().default(""),
  verdict: z.string().default(""),
});

export const questionnaireSectionSchema = z.object({
  id: z.string().min(1, "У раздела не заполнено id"),
  title: z.string().min(1, "У раздела не заполнено title"),
  description: z.string().default(""),
  order: z.number(),
  active: z.boolean(),
  parent_id: z.string().nullable(),
});

export const questionnaireQuestionSchema = z.object({
  id: z.string().min(1, "У вопроса не заполнено id"),
  section_id: z.string().nullable(),
  title: z.string().min(1, "У вопроса не заполнено title"),
  hint: z.string().default(""),
  answer_type: answerTypeSchema,
  required: z.boolean(),
  order: z.number(),
  active: z.boolean(),
  show_in_summary: z.boolean(),
  options: z.array(questionnaireOptionSchema).optional(),
  rules: z.array(questionnaireRuleSchema).optional(),
});

export const singleQuestionnaireSchema = z.object({
  schema: z.literal("first_line_questionnaire"),
  schema_version: z.number(),
  id: z.string().min(1, "У опросника не заполнено id"),
  title: z.string().min(1, "У опросника не заполнено title"),
  description: z.string().default(""),
  active: z.boolean(),
  order: z.number(),
  start_text: z.string().default(""),
  finish_text: z.string().default(""),
  sections: z.array(questionnaireSectionSchema),
  questions: z.array(questionnaireQuestionSchema),
});

export const questionnaireBundleSchema = z.object({
  schema: z.literal("first_line_questionnaires_bundle"),
  schema_version: z.number().default(1),
  exported_at: z.string().optional(),
  exported_from: z.string().optional(),
  questionnaires: z.array(singleQuestionnaireSchema),
});

export const questionnaireInputSchema = z.union([
  singleQuestionnaireSchema,
  questionnaireBundleSchema,
]);

export type QuestionnaireAnswerType = z.infer<typeof answerTypeSchema>;
export type QuestionnaireTransitionAction = z.infer<typeof transitionActionSchema>;
export type QuestionnaireOption = z.infer<typeof questionnaireOptionSchema>;
export type QuestionnaireRule = z.infer<typeof questionnaireRuleSchema>;
export type QuestionnaireSection = z.infer<typeof questionnaireSectionSchema>;
export type QuestionnaireQuestion = z.infer<typeof questionnaireQuestionSchema>;
export type Questionnaire = z.infer<typeof singleQuestionnaireSchema>;
export type QuestionnaireBundle = z.infer<typeof questionnaireBundleSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireInputSchema>;

export function isQuestionnaireBundle(
  value: QuestionnaireInput
): value is QuestionnaireBundle {
  return value.schema === "first_line_questionnaires_bundle";
}