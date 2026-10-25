import { describe, expect, it } from "vitest";
import { LOCALE_IDS } from "@/shared/types";
import type { MessageKey } from "@/shared/i18n/types";
import { en } from "@/shared/i18n/locales/en";
import { LOCALE_MESSAGES } from "@/shared/i18n/registry";
import { applyToDom, getLocale, localeDisplayName, setLanguage, t } from "@/shared/i18n";

function messageKey(value: string): MessageKey {
  return value as MessageKey;
}

describe("t", () => {
  it("interpola várias variáveis", () => {
    setLanguage("en");
    expect(t("bgHttpError", { provider: "OpenAI", status: 500 })).toBe(
      "OpenAI returned HTTP 500"
    );
  });

  it("deixa os placeholders sem valor intactos", () => {
    setLanguage("en");
    expect(t("bgHttpError", { provider: "OpenAI" })).toBe("OpenAI returned HTTP {status}");
  });

  it("substitui números convertidos em texto", () => {
    setLanguage("en");
    expect(t("cacheCountMany", { n: 3 })).toBe("3 saved transcriptions.");
  });

  it("traduz segundo o locale ativo e interpola as suas variáveis", () => {
    setLanguage("pt-BR");
    expect(t("copy")).toBe("Copiar");
    expect(t("clearedChat", { n: 2 })).toBe("Cache da conversa limpo (2).");
    expect(getLocale()).toBe("pt-BR");
  });

  it("faz fallback para en quando a chave não existe em nenhum locale", () => {
    setLanguage("pt-PT");
    expect(t(messageKey("missingKey"))).toBe("missingKey");
  });
});

describe("applyToDom", () => {
  it("escreve o texto dos elementos data-i18n e ignora chaves desconhecidas", () => {
    setLanguage("en");
    document.body.innerHTML =
      '<span data-i18n="copy"></span><span data-i18n="missingKey"></span>';
    applyToDom(document.body);
    expect(document.querySelector('[data-i18n="copy"]')?.textContent).toBe("Copy");
    expect(document.querySelector('[data-i18n="missingKey"]')?.textContent).toBe("");
  });
});

describe("localeDisplayName", () => {
  it("devolve o endónimo de cada locale", () => {
    expect(localeDisplayName("en")).toBe("English");
    expect(localeDisplayName("pt-BR")).toBe("Português (Brasil)");
    expect(localeDisplayName("pt-PT")).toBe("Português (Portugal)");
    expect(localeDisplayName("ru")).toBe("Русский");
  });
});

describe("paridade de chaves", () => {
  it("todos os locales têm exatamente o mesmo conjunto de chaves que en", () => {
    const enKeys = Object.keys(en).sort();
    for (const id of LOCALE_IDS) {
      expect(Object.keys(LOCALE_MESSAGES[id]).sort()).toEqual(enKeys);
    }
  });
});
