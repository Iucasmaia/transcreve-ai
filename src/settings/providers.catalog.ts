import type { MessageKey } from "@/shared/i18n/types";
import { DEFAULT_MODELS, KEY_FIELDS, MODEL_FIELDS } from "@/shared/settings.schema";
import { PROVIDER_IDS, type CloudProviderId, type ProviderId } from "@/shared/types";

type KeyFieldName = (typeof KEY_FIELDS)[CloudProviderId];
type ModelFieldName = (typeof MODEL_FIELDS)[keyof typeof MODEL_FIELDS];

export interface ProviderCatalogEntry {
  readonly label: string;
  readonly keyField: KeyFieldName | null;
  readonly modelField: ModelFieldName | null;
  readonly defaultModel: string | null;
  readonly models: readonly string[];
  readonly hintKey: MessageKey;
}

export const PROVIDER_CATALOG = {
  assemblyai: {
    label: "AssemblyAI",
    keyField: KEY_FIELDS.assemblyai,
    modelField: null,
    defaultModel: null,
    models: [],
    hintKey: "keyHintAssemblyai",
  },
  openai: {
    label: "OpenAI",
    keyField: KEY_FIELDS.openai,
    modelField: MODEL_FIELDS.openai,
    defaultModel: DEFAULT_MODELS.openai,
    models: [DEFAULT_MODELS.openai],
    hintKey: "keyHintOpenai",
  },
  gemini: {
    label: "Google Gemini",
    keyField: KEY_FIELDS.gemini,
    modelField: MODEL_FIELDS.gemini,
    defaultModel: DEFAULT_MODELS.gemini,
    models: [DEFAULT_MODELS.gemini, "gemini-2.5-pro", "gemini-2.0-flash"],
    hintKey: "keyHintGemini",
  },
  local: {
    label: "Local (Whisper)",
    keyField: null,
    modelField: MODEL_FIELDS.local,
    defaultModel: DEFAULT_MODELS.local,
    models: [DEFAULT_MODELS.local, "onnx-community/whisper-tiny", "onnx-community/whisper-small"],
    hintKey: "keyHintLocal",
  },
} as const satisfies Record<ProviderId, ProviderCatalogEntry>;

export function isCatalogProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDER_IDS.some((id) => id === value);
}
