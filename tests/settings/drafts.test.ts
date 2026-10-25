import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROVIDER, parseSettings } from "@/shared/settings.schema";
import {
  buildDraftFields,
  createDrafts,
  draftKeyValue,
  hydrateDrafts,
  resolveProvider,
  storeDraftValues,
} from "@/settings/drafts";

vi.mock("webextension-polyfill", () => ({
  default: {
    storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    tabs: { query: vi.fn(), sendMessage: vi.fn() },
  },
}));

describe("resolveProvider", () => {
  it("substitui um provedor guardado que já não existe no catálogo", () => {
    expect(resolveProvider("groq")).toEqual({ provider: DEFAULT_PROVIDER, replaced: true });
    expect(resolveProvider("mistral")).toEqual({ provider: DEFAULT_PROVIDER, replaced: true });
    expect(resolveProvider(undefined)).toEqual({ provider: DEFAULT_PROVIDER, replaced: true });
  });

  it("mantém um provedor conhecido do catálogo", () => {
    expect(resolveProvider("gemini")).toEqual({ provider: "gemini", replaced: false });
    expect(resolveProvider("local")).toEqual({ provider: "local", replaced: false });
  });
});

describe("rascunhos por provedor", () => {
  it("trocar de provedor preserva a chave e o modelo dos outros", () => {
    const stored = parseSettings({
      assemblyApiKey: "asm",
      openaiApiKey: "oai",
      openaiModel: "whisper-1",
      geminiApiKey: "gem",
    });
    const drafts = hydrateDrafts(stored, "assemblyai");
    storeDraftValues(drafts, "asm-edit", "");
    drafts.provider = "openai";
    storeDraftValues(drafts, "oai-edit", "whisper-large");
    drafts.provider = "assemblyai";
    expect(draftKeyValue(drafts, "assemblyai")).toBe("asm-edit");
    expect(draftKeyValue(drafts, "openai")).toBe("oai-edit");
    expect(drafts.models.openai).toBe("whisper-large");
    expect(draftKeyValue(drafts, "gemini")).toBe("gem");
  });

  it("o provedor local não tem chave e guarda apenas o modelo", () => {
    const drafts = createDrafts("local");
    storeDraftValues(drafts, "ignorada", "onnx-community/whisper-tiny");
    expect(draftKeyValue(drafts, "local")).toBe("");
    expect(drafts.models.local).toBe("onnx-community/whisper-tiny");
  });
});

describe("buildDraftFields", () => {
  it("monta o payload plano com a chave e o modelo de cada provedor", () => {
    const stored = parseSettings({
      assemblyApiKey: "asm",
      openaiApiKey: "oai",
      openaiModel: "whisper-1",
      geminiApiKey: "gem",
      geminiModel: "gemini-2.5-pro",
      localModel: "onnx-community/whisper-small",
    });
    const fields = buildDraftFields(hydrateDrafts(stored, "openai"));
    expect(fields).toEqual({
      assemblyApiKey: "asm",
      openaiApiKey: "oai",
      openaiModel: "whisper-1",
      geminiApiKey: "gem",
      geminiModel: "gemini-2.5-pro",
      localModel: "onnx-community/whisper-small",
    });
  });

  it("recorre ao modelo por defeito quando o guardado está vazio", () => {
    const fields = buildDraftFields(hydrateDrafts(parseSettings({}), "openai"));
    expect(fields.openaiModel).toBe("whisper-1");
    expect(fields.geminiModel).toBe("gemini-2.5-flash");
    expect(fields.localModel).toBe("onnx-community/whisper-base");
    expect(fields).not.toHaveProperty("assemblyModel");
  });
});
