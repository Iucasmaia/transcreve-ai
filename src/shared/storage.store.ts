import { ext } from "./browser";
import { parseCache, pruneCache } from "./cache.schema";
import { CACHE_KEY } from "./messages";
import { parseSettings, type StoredSettings } from "./settings.schema";
import type { CacheStore } from "./types";

export async function readStoredSettings(): Promise<StoredSettings> {
  const raw = await ext.storage.local.get(null);
  return parseSettings(raw);
}

export async function writeStoredSettings(patch: Record<string, unknown>): Promise<void> {
  await ext.storage.local.set(patch);
}

export async function readCache(): Promise<CacheStore> {
  const raw = await ext.storage.local.get(CACHE_KEY);
  return parseCache(raw[CACHE_KEY]);
}

export async function writeCache(cache: CacheStore): Promise<void> {
  await ext.storage.local.set({ [CACHE_KEY]: pruneCache(cache) });
}

export async function removeCache(): Promise<void> {
  await ext.storage.local.remove(CACHE_KEY);
}

export async function readPanelTheme(): Promise<StoredSettings["panelTheme"]> {
  const stored = await readStoredSettings();
  return stored.panelTheme;
}
