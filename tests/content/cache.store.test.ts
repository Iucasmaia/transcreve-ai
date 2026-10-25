import { describe, expect, it } from "vitest";
import type { CacheEntry, CacheStore } from "@/shared/types";
import { chatKeyOf, createCache, type ContentCache } from "@/content/cache.store";

function entry(text: string, chatId = "", chatName = ""): CacheEntry {
  return { text, ts: 1, chatId, chatName };
}

async function makeCache(initial: CacheStore): Promise<{ cache: ContentCache; writes: CacheStore[] }> {
  const writes: CacheStore[] = [];
  const cache = createCache({
    read: async () => initial,
    write: async (value) => {
      writes.push(value);
    },
  });
  await cache.load();
  return { cache, writes };
}

describe("chatKeyOf", () => {
  it("extrai o JID do meio do msgId", () => {
    expect(chatKeyOf("true_5511@s.whatsapp.net_ABC")).toBe("5511@s.whatsapp.net");
  });

  it("devolve vazio sem segmento de conversa", () => {
    expect(chatKeyOf("semsufixo")).toBe("");
    expect(chatKeyOf("")).toBe("");
  });
});

describe("createCache.lookup", () => {
  it("encontra a transcrição direta no cache persistente", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("olá") });
    expect(cache.lookup("true_111_A")?.text).toBe("olá");
  });

  it("casa pelo prefixo de direção invertido", async () => {
    const { cache } = await makeCache({ "false_111_A": entry("trocado") });
    expect(cache.lookup("true_111_A")?.text).toBe("trocado");
  });

  it("casa pelo hash final do id", async () => {
    const { cache } = await makeCache({ "true_111_A_abcdefgh": entry("por-hash") });
    expect(cache.lookup("false_999_B_abcdefgh")?.text).toBe("por-hash");
  });

  it("ignora hash curto", async () => {
    const { cache } = await makeCache({ "true_111_abc": entry("curto") });
    expect(cache.lookup("false_999_abc")).toBeNull();
  });

  it("devolve null para id vazio ou ausente", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("olá") });
    expect(cache.lookup("")).toBeNull();
    expect(cache.lookup("true_222_B")).toBeNull();
  });

  it("reflete a presença em has()", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("olá") });
    expect(cache.has("true_111_A")).toBe(true);
    expect(cache.has("true_333_C")).toBe(false);
  });
});

describe("createCache.store", () => {
  it("guarda em memória, no persistente e escreve", async () => {
    const { cache, writes } = await makeCache({});
    cache.store("true_111_A", "novo", "chat-1", "Nome");
    expect(cache.lookup("true_111_A")?.text).toBe("novo");
    expect(cache.lookup("true_111_A")?.chatId).toBe("chat-1");
    expect(cache.lookup("true_111_A")?.chatName).toBe("Nome");
    expect(writes.length).toBe(1);
    expect(writes[0]?.["true_111_A"]?.text).toBe("novo");
  });

  it("preserva chatId e chatName anteriores quando não informados", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("antigo", "chat-1", "Nome") });
    cache.store("true_111_A", "atualizado", "", "");
    expect(cache.lookup("true_111_A")?.text).toBe("atualizado");
    expect(cache.lookup("true_111_A")?.chatId).toBe("chat-1");
    expect(cache.lookup("true_111_A")?.chatName).toBe("Nome");
  });

  it("ignora msgId vazio", async () => {
    const { cache, writes } = await makeCache({});
    cache.store("", "texto", "", "");
    expect(writes.length).toBe(0);
  });
});

describe("createCache chat info", () => {
  it("lista apenas ids transcritos sem chatId nem chatName", async () => {
    const { cache } = await makeCache({
      "true_111_A": entry("sem-info"),
      "true_222_B": entry("com-info", "chat-2", "Nome"),
    });
    expect(cache.missingChatInfo(["true_111_A", "true_222_B", "true_333_C"])).toEqual([
      "true_111_A",
    ]);
  });

  it("preenche os campos faltantes e escreve", async () => {
    const { cache, writes } = await makeCache({ "true_111_A": entry("sem-info") });
    const changed = cache.applyChatInfo(["true_111_A"], { chatId: "chat-9", chatName: "Bia" });
    expect(changed).toBe(true);
    expect(cache.lookup("true_111_A")?.chatId).toBe("chat-9");
    expect(cache.lookup("true_111_A")?.chatName).toBe("Bia");
    expect(writes.length).toBe(1);
  });

  it("não reescreve quando nada muda", async () => {
    const { cache, writes } = await makeCache({ "true_111_A": entry("ok", "chat-9", "Bia") });
    expect(cache.applyChatInfo(["true_111_A"], { chatId: "chat-9", chatName: "Bia" })).toBe(false);
    expect(writes.length).toBe(0);
  });
});

describe("createCache.clear", () => {
  it("limpa tudo", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("um"), "true_222_B": entry("dois") });
    cache.clear("all", "");
    expect(cache.lookup("true_111_A")).toBeNull();
    expect(cache.lookup("true_222_B")).toBeNull();
  });

  it("limpa apenas a conversa indicada", async () => {
    const { cache } = await makeCache({
      "true_111_A": entry("um"),
      "true_222_B": entry("dois"),
    });
    cache.clear("chat", "111");
    expect(cache.lookup("true_111_A")).toBeNull();
    expect(cache.lookup("true_222_B")?.text).toBe("dois");
  });

  it("ignora limpeza de conversa sem id", async () => {
    const { cache } = await makeCache({ "true_111_A": entry("um") });
    cache.clear("chat", "");
    expect(cache.lookup("true_111_A")?.text).toBe("um");
  });
});
