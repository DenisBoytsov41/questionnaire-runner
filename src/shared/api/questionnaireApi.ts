import type { Questionnaire } from "../../entities/questionnaire/types";

export async function loadQuestionnaireFromPublicFile(
  fileName: string,
): Promise<Questionnaire> {
  const response = await fetch(`/questionnaires/${fileName}`);

  if (!response.ok) {
    throw new Error(`Не удалось загрузить файл опросника: ${fileName}`);
  }

  return response.json() as Promise<Questionnaire>;
}

export function parseQuestionnaireJson(rawJson: string): Questionnaire {
  try {
    return JSON.parse(rawJson) as Questionnaire;
  } catch {
    throw new Error("JSON заполнен некорректно. Проверьте синтаксис файла.");
  }
}