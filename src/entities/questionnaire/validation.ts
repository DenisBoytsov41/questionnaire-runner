import type {
  Questionnaire,
  QuestionnaireOption,
  QuestionnaireQuestion,
} from "./types";

const SUPPORTED_SCHEMA_VERSION = 1;

export function validateQuestionnaireContract(questionnaire: Questionnaire): string[] {
  const errors: string[] = [];

  if (questionnaire.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(
      `Опросник "${questionnaire.title}" имеет версию формата ${questionnaire.schema_version}. ` +
        `Текущая страница поддерживает только версию формата ${SUPPORTED_SCHEMA_VERSION}.`,
    );
  }

  if (questionnaire.sections.length === 0) {
    errors.push(`В опроснике "${questionnaire.title}" нет ни одного раздела.`);
  }

  if (questionnaire.questions.length === 0) {
    errors.push(`В опроснике "${questionnaire.title}" нет ни одного вопроса.`);
  }

  addDuplicateIdErrors(
    errors,
    questionnaire.sections,
    `В опроснике "${questionnaire.title}" несколько разделов с одинаковым кодом`,
  );

  addDuplicateIdErrors(
    errors,
    questionnaire.questions,
    `В опроснике "${questionnaire.title}" несколько вопросов с одинаковым кодом`,
  );

  addDuplicateOrderErrors(
    errors,
    questionnaire.sections,
    `В опроснике "${questionnaire.title}" несколько разделов с одинаковым порядковым номером`,
  );

  validateQuestions(questionnaire, errors);

  return errors;
}

function validateQuestions(questionnaire: Questionnaire, errors: string[]) {
  const sectionIds = new Set(questionnaire.sections.map((section) => section.id));
  const questionIds = new Set(questionnaire.questions.map((question) => question.id));
  const questionsBySection = groupQuestionsBySection(questionnaire.questions);

  questionsBySection.forEach((questions, sectionId) => {
    const sectionTitle = sectionId ?? "без раздела";

    addDuplicateOrderErrors(
      errors,
      questions,
      `В опроснике "${questionnaire.title}" в группе "${sectionTitle}" несколько вопросов с одинаковым порядковым номером`,
    );
  });

  questionnaire.questions.forEach((question) => {
    if (question.section_id && !sectionIds.has(question.section_id)) {
      errors.push(
        `Вопрос "${question.title}" ссылается на несуществующий раздел ${question.section_id}.`,
      );
    }

    validateQuestionOptions(question, errors);
    validateQuestionRules(question, questionIds, errors);
  });
}

function validateQuestionOptions(question: QuestionnaireQuestion, errors: string[]) {
  const options = question.options ?? [];

  if ((question.answer_type === "select" || question.answer_type === "multiselect") && options.length === 0) {
    errors.push(
      `Вопрос "${question.title}" имеет неподходящий тип ответа ${question.answer_type}: для него нужны варианты ответа.`,
    );
  }

  if (question.answer_type !== "select" && question.answer_type !== "multiselect" && options.length > 0) {
    errors.push(
      `Вопрос "${question.title}" имеет неподходящий тип ответа ${question.answer_type}, но содержит варианты ответа. ` +
        "Варианты допустимы только для вопросов с выбором одного или нескольких вариантов.",
    );
  }

  addDuplicateOptionValueErrors(errors, question, options);
  addDuplicateOrderErrors(errors, options, `В вопросе "${question.title}" несколько вариантов с одинаковым порядковым номером`);
}

function validateQuestionRules(
  question: QuestionnaireQuestion,
  questionIds: Set<string>,
  errors: string[],
) {
  const rules = question.rules ?? [];

  addDuplicateRuleValueErrors(errors, question);

  rules.forEach((rule) => {
    if (rule.action === "go_to_question") {
      if (!rule.question_id) {
        errors.push(
          `Вопрос "${question.title}": правило для ответа "${rule.value}" ведёт к вопросу, ` +
            "но код вопроса не заполнен.",
        );
        return;
      }

      if (!questionIds.has(rule.question_id)) {
        errors.push(
          `Вопрос "${question.title}": правило для ответа "${rule.value}" ведёт ` +
            `на несуществующий вопрос ${rule.question_id}.`,
        );
      }
    }

    if (rule.action !== "go_to_question" && rule.question_id) {
      errors.push(
        `Вопрос "${question.title}": у правила "${rule.value}" заполнен код вопроса, ` +
          `но действие ${rule.action} его не использует.`,
      );
    }

    if (!isRuleValueValidForQuestion(question, rule.value)) {
      errors.push(
        `Вопрос "${question.title}": правило для ответа "${rule.value}" не соответствует типу ` +
          `${question.answer_type} или отсутствует среди вариантов ответа.`,
      );
    }
  });
}

function isRuleValueValidForQuestion(question: QuestionnaireQuestion, ruleValue: string): boolean {
  const normalizedValue = ruleValue.trim().toLowerCase();

  if (question.answer_type === "boolean") {
    return normalizedValue === "true" || normalizedValue === "false";
  }

  if (question.answer_type === "select") {
    return (question.options ?? []).some((option) => option.value === ruleValue);
  }

  if (question.answer_type === "multiselect") {
    const optionValues = new Set((question.options ?? []).map((option) => option.value));
    const selectedValues = ruleValue.split(",").map((value) => value.trim()).filter(Boolean);

    return selectedValues.length > 0 && selectedValues.every((value) => optionValues.has(value));
  }

  return true;
}

function groupQuestionsBySection(
  questions: QuestionnaireQuestion[],
): Map<string | null, QuestionnaireQuestion[]> {
  const result = new Map<string | null, QuestionnaireQuestion[]>();

  questions.forEach((question) => {
    const group = result.get(question.section_id) ?? [];
    group.push(question);
    result.set(question.section_id, group);
  });

  return result;
}

function addDuplicateIdErrors<T extends { id: string }>(
  errors: string[],
  items: T[],
  messagePrefix: string,
) {
  addDuplicateValueErrors(errors, items.map((item) => item.id), messagePrefix);
}

function addDuplicateOrderErrors<T extends { order: number }>(
  errors: string[],
  items: T[],
  messagePrefix: string,
) {
  addDuplicateValueErrors(errors, items.map((item) => String(item.order)), messagePrefix);
}

function addDuplicateOptionValueErrors(
  errors: string[],
  question: QuestionnaireQuestion,
  options: QuestionnaireOption[],
) {
  addDuplicateValueErrors(
    errors,
    options.map((option) => option.value),
    `В вопросе "${question.title}" несколько вариантов с одинаковым значением`,
  );
}

function addDuplicateRuleValueErrors(errors: string[], question: QuestionnaireQuestion) {
  addDuplicateValueErrors(
    errors,
    (question.rules ?? []).map((rule) => rule.value),
    `В вопросе "${question.title}" несколько правил для ответа`,
  );
}

function addDuplicateValueErrors(
  errors: string[],
  values: string[],
  messagePrefix: string,
) {
  const seenValues = new Set<string>();
  const duplicatedValues = new Set<string>();

  values.forEach((value) => {
    if (seenValues.has(value)) {
      duplicatedValues.add(value);
      return;
    }

    seenValues.add(value);
  });

  duplicatedValues.forEach((value) => {
    errors.push(`${messagePrefix} ${value}.`);
  });
}
