import browser from "webextension-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/shared/i18n";
import { CACHE_CLEARED } from "@/shared/messages";
import type { CacheStore } from "@/shared/types";
import {
  allClearedMessage,
  broadcastCacheCleared,
  chatClearedMessage,
  conversationLabel,
  countLabel,
  groupCacheConversations,
  removeConversation,
} from "@/settings/cache-panel";

vi.mock("webextension-polyfill", () => ({
  default: {
    storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    tabs: { query: vi.fn(), sendMessage: vi.fn() },
  },
}));

function tab(id: number) {
  return { id, index: 0, highlighted: false, active: false, pinned: false, incognito: false };
}

function tabWithoutId() {
  return { index: 1, highlighted: false, active: false, pinned: false, incognito: false };
}

const cache: CacheStore = {
  "msg_111@c.us_a": { text: "a", ts: 1, chatId: "", chatName: "" },
  "msg_111@c.us_b": { text: "b", ts: 2, chatId: "", chatName: "Ana" },
  "msg_222@g.us_c": { text: "c", ts: 3, chatId: "222@g.us", chatName: "" },
};

beforeEach(() => {
  setLanguage("pt-BR");
  vi.mocked(browser.tabs.query).mockReset();
  vi.mocked(browser.tabs.sendMessage).mockReset();
  vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);
});

describe("countLabel", () => {
  it("usa o texto de vazio, singular e plural", () => {
    expect(countLabel(0)).toBe("Nenhuma transcrição salva.");
    expect(countLabel(1)).toBe("1 transcrição salva.");
    expect(countLabel(3)).toBe("3 transcrições salvas.");
  });
});

describe("groupCacheConversations", () => {
  it("agrupa por conversa a partir do chatId da entrada", () => {
    const groups = groupCacheConversations(cache);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ chatId: "111@c.us", chatName: "Ana", count: 2 });
    expect(groups[1]).toEqual({ chatId: "222@g.us", chatName: "", count: 1 });
  });

  it("extrai o chatId do msgId quando a entrada não o tem", () => {
    const groups = groupCacheConversations(cache);
    expect(groups[0]?.chatId).toBe("111@c.us");
  });
});

describe("conversationLabel", () => {
  it("prefere o nome e cai no chatId formatado quando não há nome", () => {
    expect(conversationLabel({ chatId: "111@c.us", chatName: "Ana", count: 2 })).toBe("Ana");
    expect(conversationLabel({ chatId: "5511@c.us", chatName: "", count: 1 })).toBe("5511");
    expect(conversationLabel({ chatId: "222@g.us", chatName: "", count: 1 })).toBe("222 (grupo)");
    expect(conversationLabel({ chatId: "", chatName: "", count: 1 })).toBe("(desconhecida)");
  });
});

describe("removeConversation", () => {
  it("remove apenas as entradas da conversa indicada", () => {
    const removal = removeConversation(cache, "111@c.us");
    expect(removal.removed).toBe(2);
    expect(Object.keys(removal.cache)).toEqual(["msg_222@g.us_c"]);
  });
});

describe("payloads do cache", () => {
  it("o payload de limpar conversa usa scope chat e o chatId", () => {
    expect(chatClearedMessage("111@c.us")).toEqual({
      type: CACHE_CLEARED,
      scope: "chat",
      chatId: "111@c.us",
    });
  });

  it("o payload de limpar tudo usa scope all sem conversa", () => {
    expect(allClearedMessage()).toEqual({ type: CACHE_CLEARED, scope: "all", chatId: "" });
  });
});

describe("broadcastCacheCleared", () => {
  it("envia CACHE_CLEARED para cada aba do WhatsApp", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([tab(7), tab(9)]);
    await broadcastCacheCleared(chatClearedMessage("abc"));
    expect(browser.tabs.query).toHaveBeenCalledWith({ url: "https://web.whatsapp.com/*" });
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: CACHE_CLEARED,
      scope: "chat",
      chatId: "abc",
    });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(9, {
      type: CACHE_CLEARED,
      scope: "chat",
      chatId: "abc",
    });
  });

  it("ignora abas sem id", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([tab(5), tabWithoutId()]);
    await broadcastCacheCleared(allClearedMessage());
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(5, {
      type: CACHE_CLEARED,
      scope: "all",
      chatId: "",
    });
  });
});
