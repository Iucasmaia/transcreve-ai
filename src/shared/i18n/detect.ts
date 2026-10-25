import type { LocaleId, UiLanguageSetting } from "@/shared/types";

function normalize(code: string): LocaleId | null {
  const value = code.toLowerCase();
  if (!value) return null;
  if (value.indexOf("pt") === 0) return value.indexOf("br") >= 0 ? "pt-BR" : "pt-PT";
  if (value.indexOf("es") === 0) return "es";
  if (value.indexOf("fr") === 0) return "fr";
  if (value.indexOf("it") === 0) return "it";
  if (value.indexOf("ru") === 0) return "ru";
  if (value.indexOf("en") === 0) return "en";
  return null;
}

export function detectLocale(languages: readonly string[]): LocaleId {
  for (const language of languages) {
    const found = normalize(language);
    if (found !== null) return found;
  }
  return "en";
}

export function resolveLocale(setting: UiLanguageSetting, languages: readonly string[]): LocaleId {
  return setting === "auto" ? detectLocale(languages) : setting;
}
