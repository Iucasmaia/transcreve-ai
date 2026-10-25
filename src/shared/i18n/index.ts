import { LOCALE_IDS, type LocaleId, type UiLanguageSetting } from "@/shared/types";
import { detectLocale } from "./detect";
import { en } from "./locales/en";
import { LOCALE_MESSAGES } from "./registry";
import type { LocaleMessages, MessageKey } from "./types";

export type TranslateVars = Record<string, string | number>;

const LOCALE_DISPLAY_NAMES: Record<LocaleId, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  ru: "Русский",
};

function readNavigatorLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const result: string[] = [];
  const languages: unknown = navigator.languages;
  if (Array.isArray(languages)) {
    for (const item of languages) {
      if (typeof item === "string" && item.length > 0) {
        result.push(item);
      }
    }
  }
  if (result.length === 0) {
    const language: unknown = navigator.language;
    if (typeof language === "string" && language.length > 0) {
      result.push(language);
    }
  }
  return result;
}

function lookup(messages: LocaleMessages, key: MessageKey): string | undefined {
  return messages[key];
}

function interpolate(text: string, vars: TranslateVars): string {
  let result = text;
  for (const name of Object.keys(vars)) {
    const value = vars[name];
    if (value === undefined) continue;
    result = result.split("{" + name + "}").join(String(value));
  }
  return result;
}

function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, value);
}

let currentLocale: LocaleId = detectLocale(readNavigatorLanguages());

export function setLanguage(setting: UiLanguageSetting): LocaleId {
  currentLocale = setting === "auto" ? detectLocale(readNavigatorLanguages()) : setting;
  return currentLocale;
}

export function getLocale(): LocaleId {
  return currentLocale;
}

export function t(key: MessageKey, vars?: TranslateVars): string {
  const text = lookup(LOCALE_MESSAGES[currentLocale], key) ?? lookup(en, key);
  if (text === undefined) return key;
  return vars ? interpolate(text, vars) : text;
}

export function applyToDom(root: ParentNode): void {
  const nodes = root.querySelectorAll("[data-i18n]");
  for (const node of nodes) {
    const key = node.getAttribute("data-i18n");
    if (key === null || !isMessageKey(key)) continue;
    node.textContent = t(key);
  }
}

export function locales(): readonly LocaleId[] {
  return LOCALE_IDS;
}

export function localeDisplayName(id: LocaleId): string {
  return LOCALE_DISPLAY_NAMES[id];
}
