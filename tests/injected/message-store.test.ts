import { describe, expect, it } from "vitest";
import { AUTO_RECENCY_TOLERANCE_SECONDS } from "@/shared/types";
import type { AutoMode } from "@/shared/types";
import { chatKindOf, isRecentEnough, shouldAutoCapture } from "@/injected/message-store";
import type { AutoWatchConfig, AutoWatchScope } from "@/injected/message-store";

const CONTACT_ID = "5511999999999@s.whatsapp.net";
const GROUP_ID = "120363000000000000@g.us";
const CHANNEL_ID = "120363000000000000@newsletter";
const STARTED_AT = 1700000000;
const ONE_HOUR_SECONDS = 3600;

function scopeOf(contacts: boolean, groups: boolean, channels: boolean): AutoWatchScope {
  return { contacts, groups, channels };
}

function configOf(mode: AutoMode, scope: AutoWatchScope): AutoWatchConfig {
  return { mode, scope };
}

const defaultScope = scopeOf(true, true, false);

describe("isRecentEnough", () => {
  it("aceita áudio com timestamp em segundos igual ao início do monitor", () => {
    expect(isRecentEnough({ t: STARTED_AT }, STARTED_AT)).toBe(true);
  });

  it("aceita áudio com timestamp em segundos pouco antes do início do monitor", () => {
    expect(isRecentEnough({ t: STARTED_AT - 30 }, STARTED_AT)).toBe(true);
  });

  it("normaliza timestamp em milissegundos dentro da tolerância", () => {
    expect(isRecentEnough({ t: STARTED_AT * 1000 }, STARTED_AT)).toBe(true);
  });

  it("rejeita em milissegundos um áudio antigo carregado depois", () => {
    expect(isRecentEnough({ t: (STARTED_AT - ONE_HOUR_SECONDS) * 1000 }, STARTED_AT)).toBe(false);
  });

  it("rejeita mensagem sem timestamp", () => {
    expect(isRecentEnough({}, STARTED_AT)).toBe(false);
    expect(isRecentEnough({ t: 0 }, STARTED_AT)).toBe(false);
    expect(isRecentEnough({ t: "sem-numero" }, STARTED_AT)).toBe(false);
  });

  it("aceita exatamente no limite de tolerância e rejeita um segundo antes", () => {
    const boundary = STARTED_AT - AUTO_RECENCY_TOLERANCE_SECONDS;
    expect(isRecentEnough({ t: boundary }, STARTED_AT)).toBe(true);
    expect(isRecentEnough({ t: boundary - 1 }, STARTED_AT)).toBe(false);
  });

  it("rejeita histórico antigo carregado ao abrir ou rolar a conversa", () => {
    expect(isRecentEnough({ t: STARTED_AT - ONE_HOUR_SECONDS }, STARTED_AT)).toBe(false);
    expect(isRecentEnough({ t: STARTED_AT - ONE_HOUR_SECONDS }, STARTED_AT + ONE_HOUR_SECONDS)).toBe(false);
  });
});

describe("shouldAutoCapture", () => {
  it("nunca captura com o modo desligado, mesmo com todos os tipos ligados", () => {
    const config = configOf("off", scopeOf(true, true, true));
    expect(shouldAutoCapture(config, CONTACT_ID)).toBe(false);
    expect(shouldAutoCapture(config, GROUP_ID)).toBe(false);
    expect(shouldAutoCapture(config, CHANNEL_ID)).toBe(false);
  });

  it("captura contatos e grupos no modo all com os tipos ligados", () => {
    const config = configOf("all", defaultScope);
    expect(shouldAutoCapture(config, CONTACT_ID)).toBe(true);
    expect(shouldAutoCapture(config, GROUP_ID)).toBe(true);
  });

  it("ignora canais por padrão nos modos chat e all", () => {
    expect(shouldAutoCapture(configOf("all", defaultScope), CHANNEL_ID)).toBe(false);
    expect(shouldAutoCapture(configOf("chat", defaultScope), CHANNEL_ID)).toBe(false);
  });

  it("captura canais apenas quando ligados explicitamente", () => {
    expect(shouldAutoCapture(configOf("all", scopeOf(true, true, true)), CHANNEL_ID)).toBe(true);
    expect(shouldAutoCapture(configOf("chat", scopeOf(false, false, true)), CHANNEL_ID)).toBe(true);
  });

  it("ignora contatos e grupos desligados", () => {
    const config = configOf("all", scopeOf(false, false, false));
    expect(shouldAutoCapture(config, CONTACT_ID)).toBe(false);
    expect(shouldAutoCapture(config, GROUP_ID)).toBe(false);
  });

  it("no modo chat aplica os tipos de conversa escolhidos", () => {
    expect(shouldAutoCapture(configOf("chat", scopeOf(true, false, false)), CONTACT_ID)).toBe(true);
    expect(shouldAutoCapture(configOf("chat", scopeOf(true, false, false)), GROUP_ID)).toBe(false);
    expect(shouldAutoCapture(configOf("chat", scopeOf(false, true, false)), GROUP_ID)).toBe(true);
  });
});

describe("chatKindOf", () => {
  it("classifica contatos, grupos e canais pelo JID", () => {
    expect(chatKindOf(CONTACT_ID)).toBe("contacts");
    expect(chatKindOf("5511999999999@c.us")).toBe("contacts");
    expect(chatKindOf(GROUP_ID)).toBe("groups");
    expect(chatKindOf(CHANNEL_ID)).toBe("channels");
  });

  it("trata JID vazio ou desconhecido como contato", () => {
    expect(chatKindOf("")).toBe("contacts");
    expect(chatKindOf("12345@broadcast")).toBe("contacts");
  });
});
