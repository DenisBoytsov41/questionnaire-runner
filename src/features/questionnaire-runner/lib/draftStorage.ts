import type { Questionnaire } from "../../../entities/questionnaire/types";
import type { RunnerState } from "../model/reducer";

interface RunnerDraft {
  questionnaireId: string;
  schemaVersion: number;
  savedAt: string;
  currentQuestionId: string | null;
  answers: RunnerState["answers"];
  history: string[];
  messages: RunnerState["messages"];
  verdicts: RunnerState["verdicts"];
  isFinished: boolean;
  startedAt: string;
  finishedAt: string | null;
}

const DRAFT_PREFIX = "ks-questionnaire-draft";

export function createRunnerStateFromDraft(questionnaire: Questionnaire): RunnerState | null {
  const draft = readRunnerDraft(questionnaire);

  if (!draft) {
    return null;
  }

  const currentQuestion = draft.currentQuestionId
    ? questionnaire.questions.find((question) => question.id === draft.currentQuestionId) ?? null
    : null;

  if (!draft.isFinished && !currentQuestion) {
    return null;
  }

  return {
    questionnaire,
    currentQuestion,
    answers: draft.answers,
    history: draft.history,
    messages: draft.messages,
    verdicts: draft.verdicts,
    isFinished: draft.isFinished,
    validationError: "",
    startedAt: draft.startedAt,
    finishedAt: draft.finishedAt,
  };
}

export function getRunnerDraftSavedAt(questionnaire: Questionnaire): string {
  return readRunnerDraft(questionnaire)?.savedAt ?? "";
}

export function saveRunnerDraft(state: RunnerState): string {
  const savedAt = new Date().toISOString();
  const draft: RunnerDraft = {
    questionnaireId: state.questionnaire.id,
    schemaVersion: state.questionnaire.schema_version,
    savedAt,
    currentQuestionId: state.currentQuestion?.id ?? null,
    answers: state.answers,
    history: state.history,
    messages: state.messages,
    verdicts: state.verdicts,
    isFinished: state.isFinished,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  };

  try {
    localStorage.setItem(getDraftKey(state.questionnaire), JSON.stringify(draft));
  } catch {
    return "";
  }

  return savedAt;
}

export function clearRunnerDraft(questionnaire: Questionnaire) {
  try {
    localStorage.removeItem(getDraftKey(questionnaire));
  } catch {
    // If browser storage is unavailable, there is nothing to clear.
  }
}

export function hasDraftContent(state: RunnerState): boolean {
  return state.isFinished || state.history.length > 0 || Object.keys(state.answers).length > 0;
}

function readRunnerDraft(questionnaire: Questionnaire): RunnerDraft | null {
  try {
    const rawDraft = localStorage.getItem(getDraftKey(questionnaire));

    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft) as RunnerDraft;

    if (
      draft.questionnaireId !== questionnaire.id ||
      draft.schemaVersion !== questionnaire.schema_version ||
      !draft.startedAt
    ) {
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

function getDraftKey(questionnaire: Questionnaire): string {
  return `${DRAFT_PREFIX}:${questionnaire.id}:v${questionnaire.schema_version}`;
}
