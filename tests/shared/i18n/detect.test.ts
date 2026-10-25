import { describe, expect, it } from "vitest";
import { detectLocale, resolveLocale } from "@/shared/i18n/detect";

describe("detectLocale", () => {
  it("mapeia pt-BR e pt_br para pt-BR", () => {
    expect(detectLocale(["pt-BR"])).toBe("pt-BR");
    expect(detectLocale(["pt_br"])).toBe("pt-BR");
  });

  it("mapeia pt e as restantes variantes pt-* para pt-PT", () => {
    expect(detectLocale(["pt"])).toBe("pt-PT");
    expect(detectLocale(["pt-PT"])).toBe("pt-PT");
    expect(detectLocale(["pt-AO"])).toBe("pt-PT");
  });

  it("mapeia es, fr, it e ru a partir do prefixo", () => {
    expect(detectLocale(["es-419"])).toBe("es");
    expect(detectLocale(["fr-CA"])).toBe("fr");
    expect(detectLocale(["it-CH"])).toBe("it");
    expect(detectLocale(["ru-RU"])).toBe("ru");
  });

  it("devolve en quando nenhum idioma é reconhecido", () => {
    expect(detectLocale(["de"])).toBe("en");
    expect(detectLocale(["nl", "ja"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });

  it("usa o primeiro idioma reconhecido da lista", () => {
    expect(detectLocale(["de", "fr", "pt-BR"])).toBe("fr");
    expect(detectLocale(["pt-PT", "pt-BR"])).toBe("pt-PT");
  });
});

describe("resolveLocale", () => {
  it("resolve auto através da lista de idiomas", () => {
    expect(resolveLocale("auto", ["pt-BR"])).toBe("pt-BR");
    expect(resolveLocale("auto", ["de"])).toBe("en");
  });

  it("devolve a definição explícita ignorando a lista", () => {
    expect(resolveLocale("ru", ["fr"])).toBe("ru");
    expect(resolveLocale("pt-PT", ["pt-BR"])).toBe("pt-PT");
  });
});
