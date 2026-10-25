import { t } from "@/shared/i18n";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function providerErrorMessage(
  data: unknown,
  status: number,
  providerLabel: string,
): string {
  if (isRecord(data)) {
    const { error } = data;
    if (typeof error === "string" && error) {
      return error;
    }
    if (isRecord(error) && typeof error.message === "string" && error.message) {
      return error.message;
    }
    if (typeof data.message === "string" && data.message) {
      return data.message;
    }
  }
  return t("bgHttpError", { provider: providerLabel, status });
}

export async function fetchJson(
  url: string,
  options: RequestInit,
  providerLabel: string,
): Promise<unknown> {
  const response = await fetch(url, options);
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(providerErrorMessage(data, response.status, providerLabel));
  }
  return data;
}

export function stringField(source: unknown, key: string): string {
  if (!isRecord(source)) return "";
  const value = source[key];
  return typeof value === "string" ? value : "";
}

export function numberField(source: unknown, key: string): number | null {
  if (!isRecord(source)) return null;
  const value = source[key];
  return typeof value === "number" ? value : null;
}
