import {
  getNextQuestionByOrder,
  getQuestionById,
  normalizeAnswerForRule,
} from "../../../entities/questionnaire/helpers";
import type {
  AppliedRuleResult,
  Questionnaire,
  QuestionnaireQuestion,
  QuestionAnswer,
} from "../../../entities/questionnaire/types";

export interface TransitionResult {
  nextQuestion: QuestionnaireQuestion | null;
  isFinished: boolean;
  message: string;
  verdict: string;
}

function findRuleForAnswer(
  question: QuestionnaireQuestion,
  answer: QuestionAnswer,
): AppliedRuleResult | null {
  const normalizedAnswer = normalizeAnswerForRule(answer);

  if (!question.rules || question.rules.length === 0) {
    return null;
  }

  const rule = question.rules.find((item) => {
    return item.value.trim().toLowerCase() === normalizedAnswer.toLowerCase();
  });

  if (!rule) {
    return null;
  }

  return {
    action: rule.action,
    questionId: rule.question_id,
    message: rule.message ?? "",
    verdict: rule.verdict ?? "",
  };
}

export function getTransitionResult(
  questionnaire: Questionnaire,
  currentQuestion: QuestionnaireQuestion,
  answer: QuestionAnswer,
): TransitionResult {
  const rule = findRuleForAnswer(currentQuestion, answer);

  if (!rule) {
    return {
      nextQuestion: getNextQuestionByOrder(questionnaire, currentQuestion),
      isFinished: false,
      message: "",
      verdict: "",
    };
  }

  if (rule.action === "finish") {
    return {
      nextQuestion: null,
      isFinished: true,
      message: rule.message,
      verdict: rule.verdict,
    };
  }

  if (rule.action === "go_to_question" && rule.questionId) {
    const nextQuestion = getQuestionById(questionnaire, rule.questionId);

    return {
      nextQuestion: nextQuestion ?? null,
      isFinished: !nextQuestion,
      message: rule.message,
      verdict: rule.verdict,
    };
  }

  return {
    nextQuestion: getNextQuestionByOrder(questionnaire, currentQuestion),
    isFinished: false,
    message: rule.message,
    verdict: rule.verdict,
  };
}