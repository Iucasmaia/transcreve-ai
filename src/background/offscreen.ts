import { ext } from "@/shared/browser";
import { t } from "@/shared/i18n";
import type { LocalWhisperRequest } from "@/shared/messages";

const OFFSCREEN_PATH = "offscreen.html";
const OFFSCREEN_JUSTIFICATION =
  "Run the local Whisper engine (WebAssembly) outside the service worker.";

function chromeOffscreen(): typeof chrome.offscreen | undefined {
  return typeof chrome === "undefined" ? undefined : chrome.offscreen;
}

export function supportsOffscreen(): boolean {
  return typeof chromeOffscreen() !== "undefined";
}

export async function ensureOffscreenDocument(): Promise<void> {
  const offscreen = chromeOffscreen();
  if (!offscreen) {
    throw new Error(t("errGeneric"));
  }
  let hasDocument = false;
  try {
    hasDocument = await offscreen.hasDocument();
  } catch {
    hasDocument = false;
  }
  if (hasDocument) {
    return;
  }
  await offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [offscreenReason()],
    justification: OFFSCREEN_JUSTIFICATION,
  });
}

function offscreenReason(): chrome.offscreen.Reason {
  return chrome.offscreen.Reason.WORKERS;
}

export async function transcribeInOffscreen(request: LocalWhisperRequest): Promise<unknown> {
  await ensureOffscreenDocument();
  return ext.runtime.sendMessage(request);
}
