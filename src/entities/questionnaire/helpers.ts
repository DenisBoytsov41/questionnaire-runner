import type {
  Questionnaire,
  QuestionnaireOption,
  QuestionnaireQuestion,
  QuestionnaireSection,
  QuestionAnswer,
} from "./types";

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return 0;
  });
}

function getSectionOrderMap(questionnaire: Questionnaire): Map<string, number> {
  const result = new Map<string, number>();

  questionnaire.sections.forEach((section) => {
    result.set(section.id, section.order);
  });

  return result;
}

function compareQuestionsBySectionAndOrder(
  questionnaire: Questionnaire,
  left: QuestionnaireQuestion,
  right: QuestionnaireQuestion,
): number {
  const sectionOrderMap = getSectionOrderMap(questionnaire);

  const leftSectionOrder = left.section_id
    ? sectionOrderMap.get(left.section_id) ?? 0
    : 0;

  const rightSectionOrder = right.section_id
    ? sectionOrderMap.get(right.section_id) ?? 0
    : 0;

  if (leftSectionOrder !== rightSectionOrder) {
    return leftSectionOrder - rightSectionOrder;
  }

  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.id.localeCompare(right.id);
}

export function getActiveSections(questionnaire: Questionnaire): QuestionnaireSection[] {
  return sortByOrder(questionnaire.sections.filter((section) => section.active));
}

export function getActiveQuestions(questionnaire: Questionnaire): QuestionnaireQuestion[] {
  return [...questionnaire.questions]
    .filter((question) => question.active)
    .sort((left, right) => compareQuestionsBySectionAndOrder(questionnaire, left, right));
}

export function getQuestionsBySection(
  questionnaire: Questionnaire,
  sectionId: string,
): QuestionnaireQuestion[] {
  return getActiveQuestions(questionnaire).filter(
    (question) => question.section_id === sectionId,
  );
}

export function getSectionById(
  questionnaire: Questionnaire,
  sectionId: string | null,
): QuestionnaireSection | undefined {
  if (!sectionId) {
    return undefined;
  }

  return questionnaire.sections.find((section) => section.id === sectionId);
}

export function getQuestionById(
  questionnaire: Questionnaire,
  questionId: string,
): QuestionnaireQuestion | undefined {
  return questionnaire.questions.find((question) => question.id === questionId);
}

export function getFirstActiveQuestion(
  questionnaire: Questionnaire,
): QuestionnaireQuestion | null {
  const questions = getMainFlowQuestions(questionnaire);

  return questions.length > 0 ? questions[0] : null;
}

export function getNextQuestionByOrder(
  questionnaire: Questionnaire,
  currentQuestion: QuestionnaireQuestion,
): QuestionnaireQuestion | null {
  const activeQuestions = getMainFlowQuestions(questionnaire);
  const currentIndex = activeQuestions.findIndex(
    (question) => question.id === currentQuestion.id,
  );

  if (currentIndex < 0) {
    return getNextQuestionAfterBranchQuestion(questionnaire, currentQuestion);
  }

  const nextQuestion = activeQuestions[currentIndex + 1];

  return nextQuestion ?? null;
}

function getNextQuestionAfterBranchQuestion(
  questionnaire: Questionnaire,
  currentQuestion: QuestionnaireQuestion,
): QuestionnaireQuestion | null {
  const mainQuestions = getMainFlowQuestions(questionnaire);

  const nextQuestion = mainQuestions.find((question) => {
    return compareQuestionsBySectionAndOrder(questionnaire, question, currentQuestion) > 0;
  });

  return nextQuestion ?? null;
}

export function getMainFlowQuestions(
  questionnaire: Questionnaire,
): QuestionnaireQuestion[] {
  const branchTargetIds = getBranchTargetQuestionIds(questionnaire);

  return getActiveQuestions(questionnaire).filter(
    (question) => !branchTargetIds.has(question.id),
  );
}

export function getBranchTargetQuestionIds(questionnaire: Questionnaire): Set<string> {
  const result = new Set<string>();

  questionnaire.questions.forEach((question) => {
    (question.rules ?? []).forEach((rule) => {
      if (rule.action === "go_to_question" && rule.question_id) {
        result.add(rule.question_id);
      }
    });
  });

  return result;
}

export function getActiveOptions(question: QuestionnaireQuestion): QuestionnaireOption[] {
  return sortByOrder((question.options ?? []).filter((option) => option.active));
}

export function normalizeAnswerForRule(answer: QuestionAnswer): string {
  if (answer === null || answer === undefined) {
    return "";
  }

  if (typeof answer === "boolean") {
    return answer ? "true" : "false";
  }

  if (typeof answer === "number") {
    return String(answer);
  }

  if (Array.isArray(answer)) {
    return answer.map((value) => String(value).trim()).filter(Boolean).join(",");
  }

  return String(answer).trim();
}

export function isAnswerEmpty(answer: QuestionAnswer): boolean {
  if (answer === null || answer === undefined) {
    return true;
  }

  if (Array.isArray(answer)) {
    return answer.length === 0;
  }

  if (typeof answer === "string") {
    return answer.trim().length === 0;
  }

  return false;
}

export function formatAnswerForSummary(
  question: QuestionnaireQuestion,
  answer: QuestionAnswer,
): string {
  if (answer === null || answer === undefined) {
    return "Не заполнено";
  }

  if (typeof answer === "boolean") {
    return answer ? "Да" : "Нет";
  }

  if (Array.isArray(answer)) {
    const options = getActiveOptions(question);

    return answer
      .map((value) => {
        const option = options.find((item) => item.value === value);
        return option?.title ?? value;
      })
      .join(", ");
  }

  if (question.answer_type === "select") {
    const option = getActiveOptions(question).find(
      (item) => item.value === String(answer),
    );

    return option?.title ?? String(answer);
  }

  return String(answer);
}