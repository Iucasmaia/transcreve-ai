import { applyToDom, localeDisplayName, locales, setLanguage, t } from "@/shared/i18n";
import type { LocaleId, UiLanguageSetting } from "@/shared/types";

export function toUiLanguageSetting(value: string): UiLanguageSetting {
  if (value === "auto") {
    return "auto";
  }
  for (const id of locales()) {
    if (id === value) {
      return id;
    }
  }
  return "auto";
}

function renderLanguageSelector(select: HTMLSelectElement, setting: UiLanguageSetting): void {
  const options: HTMLOptionElement[] = [new Option(t("autoDetect"), "auto")];
  for (const id of locales()) {
    options.push(new Option(localeDisplayName(id), id));
  }
  select.replaceChildren(...options);
  select.value = setting;
}

export function applyUiLanguage(select: HTMLSelectElement, setting: UiLanguageSetting): LocaleId {
  const locale = setLanguage(setting);
  renderLanguageSelector(select, setting);
  applyToDom(document);
  document.title = t("appTitle");
  document.documentElement.lang = locale;
  return locale;
}
