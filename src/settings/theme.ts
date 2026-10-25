import { t } from "@/shared/i18n";
import { writeStoredSettings } from "@/shared/storage.store";
import type { Theme } from "@/shared/types";

const SUN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

export interface ThemeToggle {
  apply(stored: Theme | null): void;
  refresh(): void;
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(stored: Theme | null): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return prefersDark() ? "dark" : "light";
}

function applyTheme(toggle: HTMLElement, theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  toggle.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
  toggle.title = theme === "dark" ? t("themeLight") : t("themeDark");
  toggle.setAttribute("aria-label", t("themeAria"));
}

export function createThemeToggle(toggle: HTMLElement): ThemeToggle {
  let current = resolveTheme(null);
  const paint = (): void => applyTheme(toggle, current);
  toggle.addEventListener("click", () => {
    current = current === "dark" ? "light" : "dark";
    paint();
    void writeStoredSettings({ panelTheme: current });
  });
  paint();
  return {
    apply(stored) {
      current = resolveTheme(stored);
      paint();
    },
    refresh: paint,
  };
}
