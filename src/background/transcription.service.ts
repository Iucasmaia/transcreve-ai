import { t, setLanguage } from "@/shared/i18n";
import { logDuration } from "@/shared/logger";
import { toExtensionSettings } from "@/shared/settings.schema";
import { readStoredSettings } from "@/shared/storage.store";
import type { ProviderId, TranscriptionResult } from "@/shared/types";
import { providerFor } from "./providers/registry";

export async function currentProviderId(): Promise<ProviderId> {
  const stored = await readStoredSettings();
  return stored.provider;
}

function apiKeyFor(
  settings: ReturnType<typeof toExtensionSettings>,
  provider: ProviderId,
): string {
  if (provider === "local") {
    return "";
  }
  return (settings.keys[provider] ?? "").trim();
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
): Promise<TranscriptionResult> {
  const stored = await readStoredSettings();
  const settings = toExtensionSettings(stored);
  setLanguage(settings.uiLanguage);

  if (!audioBase64) {
    throw new Error(t("bgNoAudio"));
  }

  const provider = providerFor(settings.provider);
  const apiKey = apiKeyFor(settings, provider.id);
  if (provider.needsKey && !apiKey) {
    throw new Error(t("bgNoKey", { provider: provider.label }));
  }

  const startedAt = Date.now();
  const result = await provider.run({
    settings,
    apiKey,
    audioBase64,
    mimeType,
  });
  logDuration("transcrição", `pronta (${provider.id})`, startedAt);
  return { ...result, provider: provider.id };
}
