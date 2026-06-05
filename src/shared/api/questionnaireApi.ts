import {
  isQuestionnaireBundle,
  questionnaireInputSchema,
  type Questionnaire,
  type QuestionnaireInput,
} from "../../entities/questionnaire/schema";
import {
  convertTreePackageToQuestionnaireInput,
  questionnaireTreePackageSchema,
} from "../../entities/questionnaire/treeFormat";
import { validateQuestionnaireContract } from "../../entities/questionnaire/validation";

export type QuestionnaireParseResult =
  | {
      ok: true;
      input: QuestionnaireInput;
      questionnaires: Questionnaire[];
    }
  | {
      ok: false;
      errors: string[];
    };

export async function loadQuestionnaireFromPublic(
  fileName: string,
): Promise<QuestionnaireParseResult> {
  try {
    const response = await fetch(`/questionnaires/${fileName}`);

    if (!response.ok) {
      return {
        ok: false,
        errors: [`Не удалось загрузить файл ${fileName}. HTTP ${response.status}`],
      };
    }

    const text = await response.text();
    return parseQuestionnaireJsonText(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`Ошибка загрузки файла сценария: ${getErrorMessage(error)}`],
    };
  }
}

export function parseQuestionnaireJsonText(text: string): QuestionnaireParseResult {
  let rawData: unknown;

  try {
    rawData = JSON.parse(stripJsonBom(text));
  } catch (error) {
    return {
      ok: false,
      errors: [`Файл не является корректным файлом сценария: ${getErrorMessage(error)}`],
    };
  }

  const parsed = parseSupportedQuestionnaireInput(rawData);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      }),
    };
  }

  const input = parsed.data;
  const questionnaires = isQuestionnaireBundle(input) ? input.questionnaires : [input];
  const contractErrors = questionnaires.flatMap(validateQuestionnaireContract);

  if (contractErrors.length > 0) {
    return {
      ok: false,
      errors: contractErrors,
    };
  }

  return {
    ok: true,
    input,
    questionnaires,
  };
}

function parseSupportedQuestionnaireInput(rawData: unknown) {
  const legacyParsed = questionnaireInputSchema.safeParse(rawData);

  if (legacyParsed.success) {
    return legacyParsed;
  }

  const treeParsed = questionnaireTreePackageSchema.safeParse(rawData);

  if (treeParsed.success) {
    return questionnaireInputSchema.safeParse(convertTreePackageToQuestionnaireInput(treeParsed.data));
  }

  return legacyParsed;
}

export function readJsonFile(file: File): Promise<QuestionnaireParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result ?? "");
      resolve(parseQuestionnaireJsonText(text));
    };

    reader.onerror = () => {
      resolve({
        ok: false,
        errors: ["Не удалось прочитать выбранный файл."],
      });
    };

    reader.readAsText(file, "UTF-8");
  });
}

function stripJsonBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
