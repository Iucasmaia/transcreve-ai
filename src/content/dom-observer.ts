import { log } from "@/shared/logger";
import { chatKeyOf, type CacheClearScope, type ContentCache } from "./cache.store";
import {
  createButton,
  ensureEntryButton,
  layoutAvatarButton,
  layoutFloatButton,
  refreshButtonState,
  type ButtonMode,
} from "./messages/button";
import { collectPlayElements, extractMsgId, findBalloon, findMsgContainer, findMsgRoot } from "./messages/find";
import { stopTyping } from "./messages/animation";
import { applyBoxLanguage, ensureResultBox, layoutResultBox, setBoxState } from "./messages/result-box";
import { restoreMeta, syncMeta } from "./messages/layout/timestamp";

export interface MessageEntry {
  container: HTMLElement;
  playEl: HTMLElement;
  root: Element;
  msgId: string;
  balloon: HTMLElement | null;
  button: HTMLButtonElement;
  rowEl: HTMLDivElement | null;
  box: HTMLDivElement | null;
  busy: boolean;
  mode: ButtonMode | null;
  failedModes: Partial<Record<ButtonMode, boolean>>;
  avatarEl: HTMLElement | null;
  metaEl: HTMLElement | null;
  durationEl: HTMLElement | null;
  metaHome: { top: number; right: number } | null;
  metaLog: string | null;
  diagDone: boolean;
  diagMetaSig: string | null;
}

export interface ContentObserver {
  start(): void;
  stop(): void;
  scan(): void;
  removeAll(): void;
  relayout(): void;
  applyLanguage(): void;
  applyCacheCleared(scope: CacheClearScope, chatId: string): void;
  applyTranscript(msgId: string, text: string, instant: boolean): void;
  msgIds(): string[];
}

export interface ObserverDeps {
  cache: ContentCache;
  onTranscribe(entry: MessageEntry): void;
  onAfterScan(): void;
  isSuperseded(): boolean;
}

const SCAN_INTERVAL_MS = 3000;

export function createDomObserver(deps: ObserverDeps): ContentObserver {
  const entries = new Map<string, MessageEntry>();
  let mutationObserver: MutationObserver | null = null;
  let intervalId: number | null = null;
  let scanQueued = false;

  function removeEntryUi(entry: MessageEntry): void {
    restoreMeta(entry);
    if (entry.box) stopTyping(entry.box);
    if (entry.button.isConnected) entry.button.remove();
    if (entry.rowEl && entry.rowEl.isConnected) entry.rowEl.remove();
    if (entry.box && entry.box.isConnected) entry.box.remove();
  }

  function sweepOrphans(): void {
    for (const [key, entry] of entries) {
      const playGone = !entry.playEl.isConnected;
      const containerGone = !entry.container.isConnected;
      const playOutside = !playGone && !containerGone && !entry.container.contains(entry.playEl);
      const currentId = playGone ? null : extractMsgId(entry.playEl);
      const idChanged = currentId !== null && entry.msgId !== "" && currentId !== entry.msgId;
      if (playGone || containerGone || playOutside || idChanged) {
        removeEntryUi(entry);
        entries.delete(key);
      }
    }
    const live = new Set<Element>();
    for (const entry of entries.values()) {
      live.add(entry.button);
      if (entry.rowEl) live.add(entry.rowEl);
      if (entry.box) live.add(entry.box);
    }
    for (const element of document.querySelectorAll(".wa-tr-btn, .wa-tr-btn-row, .wa-tr-box")) {
      if (!live.has(element)) element.remove();
    }
  }

  function processPlayElement(playEl: HTMLElement): void {
    const msgId = extractMsgId(playEl);
    if (!msgId) return;
    const container = findMsgContainer(playEl);
    if (!container) return;

    let entry = entries.get(msgId);
    if (!entry) {
      const created: MessageEntry = {
        container,
        playEl,
        root: findMsgRoot(playEl) ?? container,
        msgId,
        balloon: findBalloon(playEl, container),
        button: document.createElement("button"),
        rowEl: null,
        box: null,
        busy: false,
        mode: null,
        failedModes: {},
        avatarEl: null,
        metaEl: null,
        durationEl: null,
        metaHome: null,
        metaLog: null,
        diagDone: false,
        diagMetaSig: null,
      };
      created.button = createButton(() => deps.onTranscribe(created));
      entries.set(msgId, created);
      entry = created;
    }

    entry.container = container;
    entry.root = findMsgRoot(playEl) ?? container;
    entry.playEl = playEl;
    if (!entry.balloon || !entry.balloon.isConnected) {
      entry.balloon = findBalloon(playEl, container);
    }
    ensureEntryButton(entry);

    const cached = deps.cache.lookup(msgId);
    if (cached && (!entry.box || !entry.box.isConnected)) {
      const box = ensureResultBox(entry);
      setBoxState(box, "done", cached.text, null, true);
    }
    if (entry.box && entry.box.isConnected) layoutResultBox(entry);
    refreshButtonState(entry, deps.cache.has(msgId));
    syncMeta(entry);
  }

  function scan(): void {
    if (scanQueued || deps.isSuperseded()) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      if (deps.isSuperseded()) return;
      sweepOrphans();
      for (const playEl of collectPlayElements()) processPlayElement(playEl);
      deps.onAfterScan();
    });
  }

  function relayout(): void {
    for (const entry of entries.values()) {
      if (entry.mode === "float") layoutFloatButton(entry);
      if (entry.mode === "avatar") layoutAvatarButton(entry);
      if (entry.box) layoutResultBox(entry);
    }
  }

  function applyLanguage(): void {
    for (const entry of entries.values()) {
      if (entry.button.isConnected) refreshButtonState(entry, deps.cache.has(entry.msgId));
      if (entry.box && entry.box.isConnected) applyBoxLanguage(entry.box);
    }
  }

  function applyCacheCleared(scope: CacheClearScope, chatId: string): void {
    for (const entry of entries.values()) {
      if (!entry.msgId) continue;
      if (scope !== "all" && chatKeyOf(entry.msgId) !== chatId) continue;
      if (entry.box) {
        stopTyping(entry.box);
        if (entry.box.isConnected) entry.box.remove();
      }
      entry.box = null;
      entry.metaLog = null;
      entry.diagDone = false;
      entry.diagMetaSig = null;
      refreshButtonState(entry, deps.cache.has(entry.msgId));
    }
  }

  function applyTranscript(msgId: string, text: string, instant: boolean): void {
    const entry = entries.get(msgId);
    if (!entry || !entry.playEl.isConnected) return;
    const box = ensureResultBox(entry);
    setBoxState(box, "done", text, null, instant);
    syncMeta(entry);
    refreshButtonState(entry, true);
  }

  function msgIds(): string[] {
    return [...entries.keys()];
  }

  function removeAll(): void {
    for (const entry of entries.values()) removeEntryUi(entry);
    entries.clear();
  }

  function start(): void {
    scan();
    mutationObserver = new MutationObserver(scan);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    intervalId = window.setInterval(scan, SCAN_INTERVAL_MS);
    window.addEventListener("resize", relayout);
    document.addEventListener("scroll", relayout, { capture: true, passive: true });
    log.info("init", "Observador de DOM ativo");
  }

  function stop(): void {
    if (mutationObserver) mutationObserver.disconnect();
    if (intervalId !== null) window.clearInterval(intervalId);
    window.removeEventListener("resize", relayout);
    document.removeEventListener("scroll", relayout, { capture: true });
  }

  return {
    start,
    stop,
    scan,
    removeAll,
    relayout,
    applyLanguage,
    applyCacheCleared,
    applyTranscript,
    msgIds,
  };
}
