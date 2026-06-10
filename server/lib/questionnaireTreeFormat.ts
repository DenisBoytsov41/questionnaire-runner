import { z } from "zod";
import type {
  Questionnaire,
  QuestionnaireInput,
} from "./questionnaireContract.js";

type AnswerType = Questionnaire["questions"][number]["answer_type"];
type QuestionnaireRules = NonNullable<Questionnaire["questions"][number]["rules"]>;
type TransitionAction = QuestionnaireRules[number]["action"];
type QuestionnaireRule = QuestionnaireRules[number];

const treeTransitionSchema = z.object({
  action: z.enum(["next", "goToFolder", "goToQuestion", "finish"]).default("next"),
  targetId: z.string().optional(),
  message: z.string().default(""),
  verdict: z.string().default(""),
});

const treeAnswerSchema = z.object({
  text: z.string().min(1),
  order: z.number(),
  active: z.boolean().default(true),
  isOther: z.boolean().default(false),
  otherTextRequired: z.boolean().default(false),
  transition: treeTransitionSchema.default({ action: "next", message: "", verdict: "" }),
  message: z.string().default(""),
  verdict: z.string().default(""),
  showInSummary: z.boolean().default(true),
});

type TreeQuestionNode = {
  id: string;
  type: "question";
  name: string;
  active: boolean;
  order: number;
  hint: string;
  answerType: "boolean" | "singleChoice" | "multiChoice" | "text" | "number" | "date";
  required: boolean;
  showInSummary: boolean;
  startNode: boolean;
  allowOther: boolean;
  answers: Array<z.infer<typeof treeAnswerSchema>>;
};

type TreeFolderNode = {
  id: string;
  type: "folder";
  name: string;
  active: boolean;
  order: number;
  description: string;
  children: TreeNode[];
};

type TreeNode = TreeFolderNode | TreeQuestionNode;

const treeQuestionNodeSchema: z.ZodType<TreeQuestionNode> = z.object({
  id: z.string().min(1),
  type: z.literal("question"),
  name: z.string().min(1),
  active: z.boolean().default(true),
  order: z.number(),
  hint: z.string().default(""),
  answerType: z.enum(["boolean", "singleChoice", "multiChoice", "text", "number", "date"]),
  required: z.boolean().default(false),
  showInSummary: z.boolean().default(true),
  startNode: z.boolean().default(false),
  allowOther: z.boolean().default(false),
  answers: z.array(treeAnswerSchema).default([]),
});

const treeFolderNodeSchema: z.ZodType<TreeFolderNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.literal("folder"),
    name: z.string().min(1),
    active: z.boolean().default(true),
    order: z.number(),
    description: z.string().default(""),
    children: z.array(treeNodeSchema).default([]),
  }),
);

const treeNodeSchema: z.ZodType<TreeNode> = z.union([
  treeFolderNodeSchema,
  treeQuestionNodeSchema,
]);

const treeQuestionnaireNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("questionnaire"),
  name: z.string().min(1),
  active: z.boolean().default(true),
  order: z.number(),
  description: z.string().default(""),
  startText: z.string().default(""),
  finishText: z.string().default(""),
  children: z.array(treeNodeSchema).default([]),
});

export const questionnaireTreePackageSchema = z.object({
  format: z.literal("kservice_questionnaire_tree"),
  version: z.literal(1),
  exportedAt: z.string().optional(),
  source: z.record(z.string(), z.unknown()).optional(),
  questionnaires: z.array(treeQuestionnaireNodeSchema),
});

export type QuestionnaireTreePackage = z.infer<typeof questionnaireTreePackageSchema>;
type TreeQuestionnaireNode = z.infer<typeof treeQuestionnaireNodeSchema>;

export function convertTreePackageToQuestionnaireInput(
  packageData: QuestionnaireTreePackage,
): QuestionnaireInput {
  const questionnaires = packageData.questionnaires.map(convertTreeQuestionnaire);

  if (questionnaires.length === 1) {
    return questionnaires[0];
  }

  return {
    schema: "first_line_questionnaire_package",
    schema_version: packageData.version,
    exported_at: packageData.exportedAt,
    exported_from: packageData.source?.system ? String(packageData.source.system) : undefined,
    questionnaires,
  };
}

function convertTreeQuestionnaire(root: TreeQuestionnaireNode): Questionnaire {
  const sections: Questionnaire["sections"] = [];
  const questions: Questionnaire["questions"] = [];
  const foldersById = new Map<string, TreeFolderNode>();
  const questionsById = new Map<string, TreeQuestionNode>();

  function visit(node: TreeNode, parentFolderId: string | null): void {
    if (node.type === "folder") {
      foldersById.set(node.id, node);
      sections.push({
        id: node.id,
        title: node.name,
        description: node.description,
        order: node.order,
        active: node.active,
        parent_id: parentFolderId,
      });
      sortTreeNodes(node.children).forEach((child) => visit(child, node.id));
      return;
    }

    questionsById.set(node.id, node);
    questions.push({
      id: node.id,
      section_id: parentFolderId,
      title: node.name,
      hint: node.hint,
      answer_type: convertAnswerType(node.answerType),
      required: node.required,
      order: node.order,
      active: node.active,
      show_in_summary: node.showInSummary,
      start_node: node.startNode,
      options: convertOptions(node),
      rules: [],
    });
  }

  sortTreeNodes(root.children).forEach((node) => visit(node, null));

  return {
    schema: "first_line_questionnaire",
    schema_version: 1,
    id: root.id,
    title: root.name,
    description: root.description,
    active: root.active,
    order: root.order,
    start_text: root.startText,
    finish_text: root.finishText,
    sections,
    questions: questions.map((question) => {
      const sourceNode = questionsById.get(question.id);

      return {
        ...question,
        rules: sourceNode ? convertRules(sourceNode, foldersById, questionsById) : [],
      };
    }),
  };
}

function convertOptions(node: TreeQuestionNode) {
  if (node.answerType !== "singleChoice" && node.answerType !== "multiChoice") {
    return [];
  }

  return [...node.answers]
    .filter((answer) => answer.active)
    .sort((left, right) => left.order - right.order)
    .map((answer) => ({
      value: answer.text.trim(),
      title: answer.text,
      order: answer.order,
      active: answer.active,
    }));
}

function convertRules(
  node: TreeQuestionNode,
  foldersById: Map<string, TreeFolderNode>,
  questionsById: Map<string, TreeQuestionNode>,
): QuestionnaireRule[] {
  return node.answers
    .filter((answer) => answer.active)
    .map((answer) => ({
      value: node.answerType === "boolean" ? getBooleanRuleValue(answer.text) : answer.text.trim(),
      action: convertTransitionAction(answer.transition.action),
      question_id: resolveTransitionQuestionId(
        answer.transition.action,
        answer.transition.targetId,
        foldersById,
        questionsById,
      ),
      message: answer.message || answer.transition.message,
      verdict: answer.verdict || answer.transition.verdict,
    }));
}

function resolveTransitionQuestionId(
  action: "next" | "goToFolder" | "goToQuestion" | "finish",
  targetId: string | undefined,
  foldersById: Map<string, TreeFolderNode>,
  questionsById: Map<string, TreeQuestionNode>,
): string | null {
  if (action === "goToQuestion") {
    return targetId && questionsById.has(targetId) ? targetId : targetId ?? null;
  }

  if (action === "goToFolder") {
    if (!targetId || !foldersById.has(targetId)) {
      return targetId ?? null;
    }

    return findFirstActiveQuestionInFolder(foldersById.get(targetId) ?? null);
  }

  return null;
}

function findFirstActiveQuestionInFolder(folder: TreeFolderNode | null): string | null {
  if (!folder) {
    return null;
  }

  for (const child of sortTreeNodes(folder.children)) {
    if (child.type === "question" && child.active) {
      return child.id;
    }

    if (child.type === "folder" && child.active) {
      const nestedQuestionId = findFirstActiveQuestionInFolder(child);

      if (nestedQuestionId) {
        return nestedQuestionId;
      }
    }
  }

  return null;
}

function convertAnswerType(answerType: TreeQuestionNode["answerType"]): AnswerType {
  const map: Record<TreeQuestionNode["answerType"], AnswerType> = {
    boolean: "boolean",
    singleChoice: "select",
    multiChoice: "multiselect",
    text: "text",
    number: "number",
    date: "date",
  };

  return map[answerType];
}

function convertTransitionAction(
  action: "next" | "goToFolder" | "goToQuestion" | "finish",
): TransitionAction {
  if (action === "finish") {
    return "finish";
  }

  if (action === "goToFolder" || action === "goToQuestion") {
    return "go_to_question";
  }

  return "next";
}

function getBooleanRuleValue(text: string): string {
  const normalizedText = text.trim().toLowerCase();

  if (normalizedText === "да" || normalizedText === "true") {
    return "true";
  }

  if (normalizedText === "нет" || normalizedText === "false") {
    return "false";
  }

  return normalizedText;
}

function compareTreeNodes(left: TreeNode, right: TreeNode): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.id.localeCompare(right.id);
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort(compareTreeNodes);
}
