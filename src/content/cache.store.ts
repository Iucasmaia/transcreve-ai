import { findByMessageHash, messageHash, pruneCache } from "@/shared/cache.schema";
import { log } from "@/shared/logger";
import type { CacheEntry, CacheStore, ChatInfo } from "@/shared/types";

export type CacheClearScope = "chat" | "all";

export interface CacheStorage {
  read(): Promise<CacheStore>;
  write(cache: CacheStore): Promise<void>;
}

export interface ContentCache {
  load(): Promise<void>;
  lookup(msgId: string): CacheEntry | null;
  has(msgId: string): boolean;
  store(msgId: string, text: string, chatId: string, chatName: string): void;
  missingChatInfo(msgIds: readonly string[]): string[];
  applyChatInfo(msgIds: readonly string[], info: ChatInfo): boolean;
  clear(scope: CacheClearScope, chatId: string): void;
}

export function chatKeyOf(msgId: string): string {
  const parts = (msgId || "").split("_");
  return parts.length >= 2 ? (parts[1] ?? "") : "";
}

function swapDirectionPrefix(msgId: string): string | null {
  if (msgId.indexOf("true_") === 0) return `false_${msgId.slice(5)}`;
  if (msgId.indexOf("false_") === 0) return `true_${msgId.slice(6)}`;
  return null;
}

export function createCache(storage: CacheStorage): ContentCache {
  const memory = new Map<string, CacheEntry>();
  let persistent: CacheStore = {};

  function lookup(msgId: string): CacheEntry | null {
    if (!msgId) return null;
    const inMemory = memory.get(msgId);
    if (inMemory) return inMemory;
    const direct = persistent[msgId];
    if (direct && direct.text) {
      memory.set(msgId, direct);
      return direct;
    }
    const swapped = swapDirectionPrefix(msgId);
    if (swapped) {
      const swappedEntry = persistent[swapped];
      if (swappedEntry && swappedEntry.text) {
        memory.set(msgId, swappedEntry);
        return swappedEntry;
      }
    }
    const hashed = findByMessageHash(persistent, messageHash(msgId));
    if (hashed) {
      memory.set(msgId, hashed);
      return hashed;
    }
    return null;
  }

  function write(): void {
    void storage.write(persistent).catch(() => undefined);
  }

  async function load(): Promise<void> {
    try {
      persistent = await storage.read();
      log.info(
        "cache",
        `Cache persistente carregado: ${String(Object.keys(persistent).length)} transcrições`,
      );
    } catch (error) {
      log.warn("cache", "chrome.storage indisponível", String(error));
    }
  }

  function store(msgId: string, text: string, chatId: string, chatName: string): void {
    if (!msgId) return;
    const previous = persistent[msgId];
    const entry: CacheEntry = {
      text,
      ts: Date.now(),
      chatId: chatId || previous?.chatId || "",
      chatName: chatName || previous?.chatName || "",
    };
    memory.set(msgId, entry);
    persistent = pruneCache({ ...persistent, [msgId]: entry });
    write();
  }

  function missingChatInfo(msgIds: readonly string[]): string[] {
    const missing: string[] = [];
    for (const id of msgIds) {
      const entry = persistent[id];
      if (entry && entry.text && !entry.chatId && !entry.chatName) missing.push(id);
    }
    return missing;
  }

  function applyChatInfo(msgIds: readonly string[], info: ChatInfo): boolean {
    let changed = false;
    for (const id of msgIds) {
      const entry = persistent[id];
      if (!entry) continue;
      if (!entry.chatId && info.chatId) {
        entry.chatId = info.chatId;
        changed = true;
      }
      if (!entry.chatName && info.chatName) {
        entry.chatName = info.chatName;
        changed = true;
      }
    }
    if (changed) write();
    return changed;
  }

  function clear(scope: CacheClearScope, chatId: string): void {
    if (scope === "all") {
      memory.clear();
      persistent = {};
      return;
    }
    if (!chatId) return;
    const kept: CacheStore = {};
    for (const id of Object.keys(persistent)) {
      if (chatKeyOf(id) === chatId) continue;
      const entry = persistent[id];
      if (entry) kept[id] = entry;
    }
    persistent = kept;
    for (const id of [...memory.keys()]) {
      if (chatKeyOf(id) === chatId) memory.delete(id);
    }
  }

  return {
    load,
    lookup,
    has: (msgId: string): boolean => lookup(msgId) !== null,
    store,
    missingChatInfo,
    applyChatInfo,
    clear,
  };
}
