import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  KEY_FIELDS,
  cloudProviders,
  type StoredSettings,
} from "@/shared/settings.schema";
import { PROVIDER_IDS, type CloudProviderId, type ProviderId } from "@/shared/types";
import { PROVIDER_CATALOG, isCatalogProvider } from "./providers.catalog";

export interface SettingsDrafts {
  provider: ProviderId;
  keys: Record<CloudProviderId, string>;
  models: Record<ProviderId, string>;
}

export interface ProviderResolution {
  provider: ProviderId;
  replaced: boolean;
}

export function resolveProvider(raw: unknown): ProviderResolution {
  if (isCatalogProvider(raw)) {
    return { provider: raw, replaced: false };
  }
  return { provider: DEFAULT_PROVIDER, replaced: true };
}

export function createDrafts(provider: ProviderId): SettingsDrafts {
  return {
    provider,
    keys: { assemblyai: "", openai: "", gemini: "" },
    models: {
      assemblyai: DEFAULT_MODELS.assemblyai,
      openai: DEFAULT_MODELS.openai,
      gemini: DEFAULT_MODELS.gemini,
      local: DEFAULT_MODELS.local,
    },
  };
}

export function hydrateDrafts(stored: StoredSettings, provider: ProviderId): SettingsDrafts {
  const drafts = createDrafts(provider);
  for (const id of cloudProviders()) {
    drafts.keys[id] = stored[KEY_FIELDS[id]];
  }
  for (const id of PROVIDER_IDS) {
    const field = PROVIDER_CATALOG[id].modelField;
    if (field !== null && stored[field] !== "") {
      drafts.models[id] = stored[field];
    }
  }
  return drafts;
}

export function draftKeyValue(drafts: SettingsDrafts, id: ProviderId): string {
  return id === "local" ? "" : drafts.keys[id];
}

export function storeDraftValues(drafts: SettingsDrafts, keyValue: string, modelValue: string): void {
  const entry = PROVIDER_CATALOG[drafts.provider];
  if (entry.keyField !== null && drafts.provider !== "local") {
    drafts.keys[drafts.provider] = keyValue.trim();
  }
  if (entry.modelField !== null) {
    drafts.models[drafts.provider] = modelValue.trim();
  }
}

export function buildDraftFields(drafts: SettingsDrafts): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const id of cloudProviders()) {
    fields[KEY_FIELDS[id]] = drafts.keys[id].trim();
  }
  for (const id of PROVIDER_IDS) {
    const field = PROVIDER_CATALOG[id].modelField;
    if (field !== null) {
      fields[field] = drafts.models[id].trim();
    }
  }
  return fields;
}
