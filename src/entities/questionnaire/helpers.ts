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

export function getActiveSections(questionnaire: Questionnaire): QuestionnaireSection[] {
  return sortByOrder(questionnaire.sections.filter((section) => section.active));
}

export function getActiveQuestions(questionnaire: Questionnaire): QuestionnaireQuestion[] {
  return sortByOrder(questionnaire.questions.filter((question) => question.active));
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
  const questions = getActiveQuestions(questionnaire);

  return questions.length > 0 ? questions[0] : null;
}

export function getNextQuestionByOrder(
  questionnaire: Questionnaire,
  currentQuestion: QuestionnaireQuestion,
): QuestionnaireQuestion | null {
  const activeQuestions = getActiveQuestions(questionnaire);
  const currentIndex = activeQuestions.findIndex(
    (question) => question.id === currentQuestion.id,
  );

  if (currentIndex < 0) {
    return null;
  }

  const nextQuestion = activeQuestions[currentIndex + 1];

  return nextQuestion ?? null;
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