import { DEFAULT_PROVIDER } from "@/shared/settings.schema";
import type { ProviderId } from "@/shared/types";
import { runAssemblyAI } from "./assemblyai.provider";
import { runGemini } from "./gemini.provider";
import { runLocal } from "./local.provider";
import { runOpenAI } from "./openai.provider";
import { PROVIDER_LABELS, type ProviderContext, type ProviderText } from "./types";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  needsKey: boolean;
  run(context: ProviderContext): Promise<ProviderText>;
}

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  assemblyai: {
    id: "assemblyai",
    label: PROVIDER_LABELS.assemblyai,
    needsKey: true,
    run: runAssemblyAI,
  },
  openai: {
    id: "openai",
    label: PROVIDER_LABELS.openai,
    needsKey: true,
    run: runOpenAI,
  },
  gemini: {
    id: "gemini",
    label: PROVIDER_LABELS.gemini,
    needsKey: true,
    run: runGemini,
  },
  local: {
    id: "local",
    label: PROVIDER_LABELS.local,
    needsKey: false,
    run: runLocal,
  },
};

export function providerFor(id: string): ProviderDefinition {
  const found = PROVIDERS[id as ProviderId];
  return found ?? PROVIDERS[DEFAULT_PROVIDER];
}
