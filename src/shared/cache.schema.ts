import { z } from "zod";
import { MAX_CACHE_ENTRIES, type CacheEntry, type CacheStore } from "./types";

export const cacheEntrySchema = z.object({
  text: z.string(),
  ts: z.number().catch(0),
  chatId: z.string().catch(""),
  chatName: z.string().catch(""),
});

export const cacheStoreSchema = z.record(z.string(), cacheEntrySchema).catch({});

export function parseCache(raw: unknown): CacheStore {
  const result = cacheStoreSchema.safeParse(raw ?? {});
  return result.success ? result.data : {};
}

export function pruneCache(cache: CacheStore, maxEntries = MAX_CACHE_ENTRIES): CacheStore {
  const ids = Object.keys(cache);
  if (ids.length <= maxEntries) {
    return cache;
  }
  const ordered = ids.sort((left, right) => {
    const leftTs = cache[left]?.ts ?? 0;
    const rightTs = cache[right]?.ts ?? 0;
    return rightTs - leftTs;
  });
  const kept: CacheStore = {};
  for (const id of ordered.slice(0, maxEntries)) {
    const entry = cache[id];
    if (entry) {
      kept[id] = entry;
    }
  }
  return kept;
}

export function chatIdFromEntry(msgId: string, entry: CacheEntry | undefined): string {
  if (entry?.chatId) {
    return entry.chatId;
  }
  const parts = msgId.split("_");
  return parts.length >= 2 ? (parts[1] ?? "") : "";
}

export function messageHash(msgId: string): string {
  const parts = msgId.split("_");
  return parts.length >= 3 ? (parts[parts.length - 1] ?? "") : "";
}

export function findByMessageHash(cache: CacheStore, hash: string): CacheEntry | undefined {
  if (hash.length < 8) {
    return undefined;
  }
  for (const id of Object.keys(cache)) {
    if (id.endsWith(`_${hash}`)) {
      const entry = cache[id];
      if (entry?.text) {
        return entry;
      }
    }
  }
  return undefined;
}
