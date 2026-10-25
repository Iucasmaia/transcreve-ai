import { describe, expect, it, vi } from "vitest";
import { AUTO_RECENCY_TOLERANCE_SECONDS } from "@/shared/types";
import type { AutoMode } from "@/shared/types";
import {
  chatKindOf,
  shouldTranscribeAuto,
  type AutoDecisionInput,
  type AutoSettings,
} from "@/content/auto-transcribe";

vi.mock("webextension-polyfill", () => ({ default: {} }));

const CONTACT_ID = "5511999999999@s.whatsapp.net";
const GROUP_ID = "120363000000000000@g.us";
const CHANNEL_ID = "120363000000000000@newsletter";
const NOW = 1700000000;

const DEFAULT_SETTINGS: AutoSettings = {
  mode: "all",
  contacts: true,
  groups: true,
  channels: false,
};

function decision(overrides: Partial<AutoDecisionInput> = {}): AutoDecisionInput {
  return {
    settings: overrides.settings ?? DEFAULT_SETTINGS,
    chatId: overrides.chatId ?? CONTACT_ID,
    activeChatId: overrides.activeChatId ?? "",
    timestamp: overrides.timestamp ?? NOW,
    nowSeconds: overrides.nowSeconds ?? NOW,
    alreadyAttempted: overrides.alreadyAttempted ?? false,
    cached: overrides.cached ?? false,
  };
}

function withMode(mode: AutoMode): AutoSettings {
  return { ...DEFAULT_SETTINGS, mode };
}

describe("chatKindOf", () => {
  it("classifica contatos, grupos e canais pelo JID", () => {
    expect(chatKindOf(CONTACT_ID)).toBe("contacts");
    expect(chatKindOf(GROUP_ID)).toBe("groups");
    expect(chatKindOf(CHANNEL_ID)).toBe("channels");
  });

  it("trata JID vazio ou desconhecido como contato", () => {
    expect(chatKindOf("")).toBe("contacts");
    expect(chatKindOf("12345@broadcast")).toBe("contacts");
  });
});

describe("shouldTranscribeAuto", () => {
  it("nunca transcreve com o modo desligado", () => {
    expect(shouldTranscribeAuto(decision({ settings: withMode("off") }))).toBe(false);
  });

  it("ignora áudio já tentado", () => {
    expect(shouldTranscribeAuto(decision({ alreadyAttempted: true }))).toBe(false);
  });

  it("ignora áudio já presente no cache", () => {
    expect(shouldTranscribeAuto(decision({ cached: true }))).toBe(false);
  });

  it("no modo chat aceita apenas a conversa aberta", () => {
    expect(
      shouldTranscribeAuto(
        decision({ settings: withMode("chat"), chatId: GROUP_ID, activeChatId: CONTACT_ID }),
      ),
    ).toBe(false);
    expect(
      shouldTranscribeAuto(
        decision({ settings: withMode("chat"), chatId: CONTACT_ID, activeChatId: CONTACT_ID }),
      ),
    ).toBe(true);
  });

  it("no modo chat sem conversa ativa não filtra por conversa", () => {
    expect(
      shouldTranscribeAuto(decision({ settings: withMode("chat"), chatId: GROUP_ID, activeChatId: "" })),
    ).toBe(true);
  });

  it("ignora canais por padrão nos modos chat e all", () => {
    expect(shouldTranscribeAuto(decision({ settings: withMode("all"), chatId: CHANNEL_ID }))).toBe(
      false,
    );
    expect(shouldTranscribeAuto(decision({ settings: withMode("chat"), chatId: CHANNEL_ID }))).toBe(
      false,
    );
  });

  it("aceita canais quando explicitamente ligados", () => {
    const settings: AutoSettings = { mode: "all", contacts: true, groups: true, channels: true };
    expect(shouldTranscribeAuto(decision({ settings, chatId: CHANNEL_ID }))).toBe(true);
  });

  it("ignora contatos e grupos desligados", () => {
    const settings: AutoSettings = { mode: "all", contacts: false, groups: false, channels: false };
    expect(shouldTranscribeAuto(decision({ settings, chatId: CONTACT_ID }))).toBe(false);
    expect(shouldTranscribeAuto(decision({ settings, chatId: GROUP_ID }))).toBe(false);
  });

  it("aceita áudio dentro da tolerância de recência", () => {
    expect(shouldTranscribeAuto(decision({ timestamp: NOW - 30 }))).toBe(true);
  });

  it("aceita exatamente no limite de tolerância e rejeita um segundo antes", () => {
    const boundary = NOW - AUTO_RECENCY_TOLERANCE_SECONDS;
    expect(shouldTranscribeAuto(decision({ timestamp: boundary }))).toBe(true);
    expect(shouldTranscribeAuto(decision({ timestamp: boundary - 1 }))).toBe(false);
  });

  it("rejeita histórico antigo carregado ao abrir a conversa", () => {
    expect(shouldTranscribeAuto(decision({ timestamp: NOW - 3600 }))).toBe(false);
  });

  it("normaliza timestamp em milissegundos", () => {
    expect(shouldTranscribeAuto(decision({ timestamp: NOW * 1000 }))).toBe(true);
  });

  it("rejeita mensagem sem timestamp", () => {
    expect(shouldTranscribeAuto(decision({ timestamp: 0 }))).toBe(false);
  });
});
