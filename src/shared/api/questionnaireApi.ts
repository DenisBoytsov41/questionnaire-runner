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
      errors: parsed.errors,
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
  if (!isJsonObject(rawData)) {
    return {
      success: false as const,
      errors: ["В корне JSON должен находиться объект с описанием одного или нескольких сценариев."],
    };
  }

  if (rawData.format === "kservice_questionnaire_tree") {
    const treeParsed = questionnaireTreePackageSchema.safeParse(rawData);

    if (!treeParsed.success) {
      return {
        success: false as const,
        errors: formatSchemaIssues(treeParsed.error.issues),
      };
    }

    const converted = questionnaireInputSchema.safeParse(
      convertTreePackageToQuestionnaireInput(treeParsed.data),
    );

    if (!converted.success) {
      return {
        success: false as const,
        errors: formatSchemaIssues(converted.error.issues),
      };
    }

    return {
      success: true as const,
      data: converted.data,
    };
  }

  if (typeof rawData.schema === "string") {
    const legacyParsed = questionnaireInputSchema.safeParse(rawData);

    if (legacyParsed.success) {
      return {
        success: true as const,
        data: legacyParsed.data,
      };
    }

    return {
      success: false as const,
      errors: formatSchemaIssues(legacyParsed.error.issues),
    };
  }

  return {
    success: false as const,
    errors: [
      "Не удалось распознать формат выгрузки.",
      'Для новой структуры укажите "format": "kservice_questionnaire_tree", "version": 1 и массив "questionnaires".',
      'Для прежней структуры требуется поле "schema": "first_line_questionnaire" или поле пакета сценариев.',
    ],
  };
}

function formatSchemaIssues(
  issues: ReadonlyArray<{
    code: string;
    path: PropertyKey[];
    message: string;
    expected?: string;
    values?: unknown[];
  }>,
): string[] {
  return issues.slice(0, 10).map((issue) => {
    const path = formatIssuePath(issue.path);
    const location = path ? `Поле «${path}»` : "Структура JSON";

    if (issue.code === "invalid_type") {
      return `${location} отсутствует или имеет неверный тип${formatExpectedType(issue.expected)}.`;
    }

    if (issue.code === "invalid_value" && issue.values?.length) {
      return `${location} содержит недопустимое значение. Допустимо: ${issue.values
        .map((value) => JSON.stringify(value))
        .join(", ")}.`;
    }

    if (issue.code === "too_small") {
      return `${location} не должно быть пустым.`;
    }

    if (issue.code === "invalid_union") {
      return `${location} не соответствует поддерживаемой структуре сценария.`;
    }

    return `${location}: ${translateValidationMessage(issue.message)}.`;
  });
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part + 1}]`;
    }

    return result ? `${result}.${String(part)}` : String(part);
  }, "");
}

function formatExpectedType(expected: string | undefined): string {
  const labels: Record<string, string> = {
    array: "массив",
    boolean: "логическое значение",
    number: "число",
    object: "объект",
    string: "строка",
  };

  return expected ? ` (ожидается ${labels[expected] ?? expected})` : "";
}

function translateValidationMessage(message: string): string {
  if (message === "Invalid input") {
    return "указано некорректное значение";
  }

  if (message.startsWith("Invalid input: expected ")) {
    return "значение имеет неверный тип";
  }

  return message.replace(/\.$/, "");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
