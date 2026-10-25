import browser from "webextension-polyfill";

export const ext = browser;

export function extensionUrl(path: string): string {
  return browser.runtime.getURL(path);
}

export function isServiceWorkerContext(): boolean {
  return typeof window === "undefined" && typeof self !== "undefined" && "skipWaiting" in self;
}

export function isBackgroundPageContext(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && "browser" in globalThis;
}

export function hasOffscreenSupport(): boolean {
  const candidate = globalThis as { chrome?: { offscreen?: unknown } };
  return typeof candidate.chrome?.offscreen !== "undefined";
}

export function detectedLanguages(): readonly string[] {
  return typeof navigator === "undefined" ? [] : navigator.languages;
}
