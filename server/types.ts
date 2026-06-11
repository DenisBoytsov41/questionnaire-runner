import type { Questionnaire } from "./lib/questionnaireContract.js";

export type UserRole = "user" | "operator" | "admin" | "superadmin";
export type QuestionAnswer = string | string[] | boolean | number | null;

export interface StoredUser {
  id: string;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  role: UserRole;
  active: boolean;
  preferences: UserPreferences;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  role: UserRole;
  active: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark";
  textSize: "normal" | "large" | "xlarge";
  readingMode: "normal" | "high-contrast";
  profileIcon: "person" | "headset" | "shield" | "star" | "check";
  profileColor: "teal" | "mint" | "blue" | "amber" | "rose";
  avatarImage: string;
}

export interface StoredQuestionnaireVersion {
  id: string;
  questionnaireId: string;
  version: number;
  title: string;
  active: boolean;
  published: boolean;
  source: Questionnaire;
  importedBy: string;
  importedAt: string;
}

export interface StoredQuestionnaire {
  id: string;
  title: string;
  activeVersionId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionnaireRun {
  id: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  operatorId: string;
  status: "draft" | "finished";
  currentQuestionId: string | null;
  answers: Record<string, QuestionAnswer>;
  route: string[];
  messages: string[];
  verdicts: string[];
  summaryText: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}
