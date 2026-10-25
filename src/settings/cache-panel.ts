import { ext } from "@/shared/browser";
import { chatIdFromEntry } from "@/shared/cache.schema";
import { t } from "@/shared/i18n";
import { CACHE_CLEARED, isCacheClearedMessage, type CacheClearedMessage } from "@/shared/messages";
import { readCache, removeCache, writeCache } from "@/shared/storage.store";
import type { CacheStore } from "@/shared/types";

const WHATSAPP_TAB_URL = "https://web.whatsapp.com/*";

export interface CacheConversation {
  chatId: string;
  chatName: string;
  count: number;
}

export interface CacheRemoval {
  cache: CacheStore;
  removed: number;
}

export interface CachePanel {
  refresh(): Promise<void>;
  clearChat(): Promise<void>;
  clearAll(): Promise<void>;
}

interface CachePanelElements {
  count: HTMLElement;
  select: HTMLSelectElement;
  clearChat: HTMLButtonElement;
  clearAll: HTMLButtonElement;
}

type CachePanelStatus = (text: string, kind: "ok" | "error") => void;

function requireElement<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) {
    throw new Error(selector);
  }
  return found;
}

export function countLabel(total: number): string {
  if (total === 0) {
    return t("cacheNone");
  }
  return total === 1 ? t("cacheCountOne", { n: total }) : t("cacheCountMany", { n: total });
}

export function groupCacheConversations(cache: CacheStore): CacheConversation[] {
  const byChat = new Map<string, CacheConversation>();
  for (const [messageId, entry] of Object.entries(cache)) {
    const chatId = chatIdFromEntry(messageId, entry);
    const group = byChat.get(chatId);
    if (group === undefined) {
      byChat.set(chatId, { chatId, chatName: entry.chatName, count: 1 });
      continue;
    }
    group.count += 1;
    if (group.chatName === "") {
      group.chatName = entry.chatName;
    }
  }
  return [...byChat.values()].sort((left, right) => right.count - left.count);
}

export function conversationLabel(group: CacheConversation): string {
  if (group.chatName !== "") {
    return group.chatName;
  }
  if (group.chatId === "") {
    return t("unknownConversation");
  }
  if (/@g\.us$/i.test(group.chatId)) {
    return t("groupSuffix", { id: group.chatId.replace(/@g\.us$/i, "") });
  }
  return group.chatId.replace(/@c\.us$/i, "").replace(/@s\.whatsapp\.net$/i, "");
}

export function removeConversation(cache: CacheStore, chatId: string): CacheRemoval {
  const kept: CacheStore = {};
  let removed = 0;
  for (const [messageId, entry] of Object.entries(cache)) {
    if (chatIdFromEntry(messageId, entry) === chatId) {
      removed += 1;
      continue;
    }
    kept[messageId] = entry;
  }
  return { cache: kept, removed };
}

export function chatClearedMessage(chatId: string): CacheClearedMessage {
  return { type: CACHE_CLEARED, scope: "chat", chatId };
}

export function allClearedMessage(): CacheClearedMessage {
  return { type: CACHE_CLEARED, scope: "all", chatId: "" };
}

export async function broadcastCacheCleared(message: CacheClearedMessage): Promise<void> {
  if (!isCacheClearedMessage(message)) {
    return;
  }
  const tabs = await ext.tabs.query({ url: WHATSAPP_TAB_URL });
  const targets = tabs.flatMap((tab) => (typeof tab.id === "number" ? [tab.id] : []));
  await Promise.allSettled(targets.map((id) => ext.tabs.sendMessage(id, message)));
}

function renderCachePanel(elements: CachePanelElements, cache: CacheStore): void {
  const total = Object.keys(cache).length;
  const groups = groupCacheConversations(cache);
  elements.count.textContent = countLabel(total);
  elements.select.replaceChildren();
  if (groups.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("noConversation");
    elements.select.appendChild(option);
  } else {
    for (const group of groups) {
      const option = document.createElement("option");
      option.value = group.chatId;
      option.textContent = `${conversationLabel(group)} — ${group.count}`;
      elements.select.appendChild(option);
    }
  }
  elements.clearChat.disabled = groups.length === 0;
  elements.clearAll.disabled = total === 0;
}

function createCachePanel(elements: CachePanelElements, setStatus: CachePanelStatus): CachePanel {
  async function refresh(): Promise<void> {
    renderCachePanel(elements, await readCache());
  }

  async function clearChat(): Promise<void> {
    const chatId = elements.select.value;
    if (chatId === "") {
      return;
    }
    const removal = removeConversation(await readCache(), chatId);
    await writeCache(removal.cache);
    renderCachePanel(elements, removal.cache);
    await broadcastCacheCleared(chatClearedMessage(chatId));
    setStatus(t("clearedChat", { n: removal.removed }), "ok");
  }

  async function clearAll(): Promise<void> {
    await removeCache();
    renderCachePanel(elements, {});
    await broadcastCacheCleared(allClearedMessage());
    setStatus(t("clearedAll"), "ok");
  }

  return { refresh, clearChat, clearAll };
}

export function mountCachePanel(setStatus: CachePanelStatus): CachePanel {
  const elements: CachePanelElements = {
    count: requireElement<HTMLElement>("#cacheCount"),
    select: requireElement<HTMLSelectElement>("#cacheConversation"),
    clearChat: requireElement<HTMLButtonElement>("#clearChat"),
    clearAll: requireElement<HTMLButtonElement>("#clearAll"),
  };
  const panel = createCachePanel(elements, setStatus);
  elements.clearChat.addEventListener("click", () => void panel.clearChat());
  elements.clearAll.addEventListener("click", () => void panel.clearAll());
  return panel;
}
