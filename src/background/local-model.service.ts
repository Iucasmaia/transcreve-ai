import { ext } from "@/shared/browser";
import { log } from "@/shared/logger";
import { LOCAL_WHISPER_PRELOAD, type LocalWhisperPreloadRequest } from "@/shared/messages";
import { toExtensionSettings } from "@/shared/settings.schema";
import { readStoredSettings } from "@/shared/storage.store";
import { getWhisperHost } from "@/whisper/host";
import { ensureOffscreenDocument, supportsOffscreen } from "./offscreen";

async function requestOffscreenPreload(request: LocalWhisperPreloadRequest): Promise<void> {
  await ensureOffscreenDocument();
  await ext.runtime.sendMessage(request);
}

export async function preloadLocalModel(): Promise<void> {
  const stored = await readStoredSettings();
  const settings = toExtensionSettings(stored);
  const model = settings.models.local;
  const request: LocalWhisperPreloadRequest = { type: LOCAL_WHISPER_PRELOAD, model };
  if (supportsOffscreen()) {
    await requestOffscreenPreload(request);
    return;
  }
  await getWhisperHost().preload(model);
  log.info("modelo", "Whisper local pré-carregado", model);
}
