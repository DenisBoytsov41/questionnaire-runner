import { z } from "zod";

const answerTypeSchema = z.enum([
  "string",
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "file",
]);

const transitionActionSchema = z.enum([
  "next",
  "go_to_question",
  "finish",
]);

const questionnaireOptionSchema = z.object({
  value: z.string().min(1),
  title: z.string().min(1),
  order: z.number(),
  active: z.boolean(),
});

const questionnaireRuleSchema = z.object({
  value: z.string().min(1),
  action: transitionActionSchema,
  question_id: z.string().nullable(),
  message: z.string().default(""),
  verdict: z.string().default(""),
});

const questionnaireSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  order: z.number(),
  active: z.boolean(),
  parent_id: z.string().nullable(),
});

const questionnaireQuestionSchema = z.object({
  id: z.string().min(1),
  section_id: z.string().nullable(),
  title: z.string().min(1),
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
  id: z.string().min(1),
  title: z.string().min(1),
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

export type Questionnaire = z.infer<typeof singleQuestionnaireSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireInputSchema>;

export function isQuestionnaireBundle(value: QuestionnaireInput): value is z.infer<typeof questionnaireBundleSchema> {
  return value.schema === "first_line_questionnaires_bundle";
}

export function validateQuestionnaireContract(questionnaire: Questionnaire): string[] {
  const errors: string[] = [];
  const sectionIds = new Set(questionnaire.sections.map((section) => section.id));
  const questionIds = new Set(questionnaire.questions.map((question) => question.id));

  addDuplicateErrors(questionnaire.sections.map((section) => section.id), "Найдены разделы с одинаковым кодом", errors);
  addDuplicateErrors(questionnaire.questions.map((question) => question.id), "Найдены вопросы с одинаковым кодом", errors);

  questionnaire.questions.forEach((question) => {
    if (question.section_id && !sectionIds.has(question.section_id)) {
      errors.push(`Вопрос "${question.title}" привязан к несуществующему разделу.`);
    }

    if ((question.answer_type === "select" || question.answer_type === "multiselect") && !question.options?.length) {
      errors.push(`У вопроса "${question.title}" нет вариантов ответа.`);
    }

    question.rules?.forEach((rule) => {
      if (rule.action === "go_to_question" && (!rule.question_id || !questionIds.has(rule.question_id))) {
        errors.push(`Правило вопроса "${question.title}" ведёт к несуществующему вопросу.`);
      }
    });
  });

  return errors;
}

function addDuplicateErrors(values: string[], message: string, errors: string[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }

    seen.add(value);
  });

  duplicates.forEach((value) => errors.push(`${message}: ${value}.`));
}
