import type { ExtensionSettings, ProviderId } from "@/shared/types";

export interface ProviderText {
  text: string;
  languageCode: string | null;
  confidence: number | null;
}

export interface ProviderContext {
  settings: ExtensionSettings;
  apiKey: string;
  audioBase64: string;
  mimeType: string;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  assemblyai: "AssemblyAI",
  openai: "OpenAI",
  gemini: "Google Gemini",
  local: "Local (Whisper)",
};

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const ASSEMBLY_BASE_URL = "https://api.assemblyai.com/v2";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const POLL_INTERVAL_MS = 3000;
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;
