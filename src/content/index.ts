import { ext } from "@/shared/browser";
import { setLanguage } from "@/shared/i18n";
import { log } from "@/shared/logger";
import { addMessageListener } from "@/shared/messaging.util";
import { isCacheClearedMessage } from "@/shared/messages";
import { parseSettings } from "@/shared/settings.schema";
import { readCache, readStoredSettings, writeCache } from "@/shared/storage.store";
import type { UiLanguageSetting } from "@/shared/types";
import { createAutoTranscription, type AutoController } from "./auto-transcribe";
import { createCache } from "./cache.store";
import { createDomObserver } from "./dom-observer";
import { createPageBridge } from "./page-bridge";
import { createTranscribeFlow, type TranscribeFlow } from "./transcription";

const CONTENT_VERSION = "1.4.0";

function start(): void {
  const generationToken = `${CONTENT_VERSION}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  document.documentElement.dataset.waTrGen = generationToken;
  let superseded = false;

  const cache = createCache({ read: readCache, write: writeCache });
  let flow: TranscribeFlow | null = null;
  let auto: AutoController | null = null;

  function isSuperseded(): boolean {
    if (superseded) return true;
    if (document.documentElement.dataset.waTrGen !== generationToken) {
      superseded = true;
      log.warn("init", "Instância substituída por uma mais nova; removendo a UI desta instância");
      observer.removeAll();
      observer.stop();
      return true;
    }
    return false;
  }

  const observer = createDomObserver({
    cache,
    onTranscribe: (entry) => {
      if (flow) void flow.transcribe(entry);
    },
    onAfterScan: () => {
      if (!auto) return;
      auto.backfillChatInfo();
      auto.syncActiveChat();
    },
    isSuperseded,
  });

  const bridge = createPageBridge({
    onAutoAudio: (audio) => {
      if (auto) auto.handleAudio(audio);
    },
    onReady: () => {
      if (auto) auto.notifyWatch();
    },
  });

  flow = createTranscribeFlow({ bridge, cache });
  auto = createAutoTranscription({ bridge, cache, observer });

  function applyLanguage(setting: UiLanguageSetting): void {
    setLanguage(setting);
    observer.applyLanguage();
  }

  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes.uiLanguage;
    if (!change) return;
    applyLanguage(parseSettings({ uiLanguage: change.newValue }).uiLanguage);
  });

  addMessageListener((message) => {
    if (!isCacheClearedMessage(message)) return undefined;
    cache.clear(message.scope, message.chatId);
    observer.applyCacheCleared(message.scope, message.chatId);
    return undefined;
  });

  void readStoredSettings()
    .then((stored) => applyLanguage(stored.uiLanguage))
    .catch(() => undefined);
  void cache.load().then(() => observer.scan());
  auto.start();
  observer.start();
  void bridge.ensurePageAlive(6000).then((alive) => {
    log.info("init", `Script de página (MAIN): ${alive ? "respondendo" : "ainda não respondeu"}`);
  });
  log.info("init", `Extensão ativa (v${CONTENT_VERSION})`);
}

if (document.body) {
  start();
} else {
  document.addEventListener("DOMContentLoaded", () => start());
}
