import { z } from "zod";
import {
  LOCALE_IDS,
  PROVIDER_IDS,
  type AutoMode,
  type CloudProviderId,
  type ExtensionSettings,
  type LanguageMode,
  type ProviderId,
  type Theme,
} from "./types";

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  assemblyai: "best",
  openai: "whisper-1",
  gemini: "gemini-2.5-flash",
  local: "onnx-community/whisper-base",
};

export const DEFAULT_PROVIDER: ProviderId = "local";

export const KEY_FIELDS = {
  assemblyai: "assemblyApiKey",
  openai: "openaiApiKey",
  gemini: "geminiApiKey",
} as const satisfies Record<CloudProviderId, string>;

export const MODEL_FIELDS = {
  openai: "openaiModel",
  gemini: "geminiModel",
  local: "localModel",
} as const;

export const MODEL_FIELD_NAMES: readonly string[] = Object.values(MODEL_FIELDS);
export const KEY_FIELD_NAMES: readonly string[] = Object.values(KEY_FIELDS);

export const settingsSchema = z
  .object({
    provider: z.enum(PROVIDER_IDS).catch(DEFAULT_PROVIDER),
    languageMode: z.enum(["auto", "manual"]).catch("auto") as z.ZodType<LanguageMode>,
    languageCode: z.string().catch("pt"),
    autoMode: z.enum(["off", "chat", "all"]).catch("all") as z.ZodType<AutoMode>,
    autoContacts: z.boolean().catch(true),
    autoGroups: z.boolean().catch(true),
    autoChannels: z.boolean().catch(false),
    uiLanguage: z.union([z.literal("auto"), z.enum(LOCALE_IDS)]).catch("auto"),
    panelTheme: z.union([z.enum(["light", "dark"]), z.null()]).catch(null) as z.ZodType<Theme | null>,
    assemblyApiKey: z.string().catch(""),
    openaiApiKey: z.string().catch(""),
    geminiApiKey: z.string().catch(""),
    openaiModel: z.string().catch(DEFAULT_MODELS.openai),
    geminiModel: z.string().catch(DEFAULT_MODELS.gemini),
    localModel: z.string().catch(DEFAULT_MODELS.local),
  })
  .catch({
    provider: DEFAULT_PROVIDER,
    languageMode: "auto",
    languageCode: "pt",
    autoMode: "all",
    autoContacts: true,
    autoGroups: true,
    autoChannels: false,
    uiLanguage: "auto",
    panelTheme: null,
    assemblyApiKey: "",
    openaiApiKey: "",
    geminiApiKey: "",
    openaiModel: DEFAULT_MODELS.openai,
    geminiModel: DEFAULT_MODELS.gemini,
    localModel: DEFAULT_MODELS.local,
  });

export type StoredSettings = z.infer<typeof settingsSchema>;

export function parseSettings(raw: unknown): StoredSettings {
  return settingsSchema.parse(raw ?? {});
}

export function toExtensionSettings(stored: StoredSettings): ExtensionSettings {
  return {
    provider: stored.provider,
    languageMode: stored.languageMode,
    languageCode: stored.languageCode,
    autoMode: stored.autoMode,
    autoContacts: stored.autoContacts,
    autoGroups: stored.autoGroups,
    autoChannels: stored.autoChannels,
    uiLanguage: stored.uiLanguage,
    panelTheme: stored.panelTheme,
    keys: {
      assemblyai: stored.assemblyApiKey,
      openai: stored.openaiApiKey,
      gemini: stored.geminiApiKey,
    },
    models: {
      assemblyai: DEFAULT_MODELS.assemblyai,
      openai: stored.openaiModel || DEFAULT_MODELS.openai,
      gemini: stored.geminiModel || DEFAULT_MODELS.gemini,
      local: stored.localModel || DEFAULT_MODELS.local,
    },
  };
}

export function cloudProviders(): readonly CloudProviderId[] {
  return ["assemblyai", "openai", "gemini"];
}
