import { ext } from "@/shared/browser";
import { t } from "@/shared/i18n";
import { log } from "@/shared/logger";
import { readStoredSettings } from "@/shared/storage.store";
import { AUTO_RECENCY_TOLERANCE_SECONDS, type AutoAudioPayload, type AutoMode } from "@/shared/types";
import type { ContentCache } from "./cache.store";
import type { ContentObserver } from "./dom-observer";
import { isChatInfo, type PageBridge } from "./page-bridge";
import { requestTranscription } from "./transcription";

export interface AutoSettings {
  mode: AutoMode;
  contacts: boolean;
  groups: boolean;
  channels: boolean;
}

export type ChatKind = "contacts" | "groups" | "channels";

export interface AutoDecisionInput {
  settings: AutoSettings;
  chatId: string;
  activeChatId: string;
  timestamp: number;
  nowSeconds: number;
  alreadyAttempted: boolean;
  cached: boolean;
}

export interface AutoController {
  start(): void;
  handleAudio(payload: AutoAudioPayload): void;
  notifyWatch(): void;
  backfillChatInfo(): void;
  syncActiveChat(): void;
}

export interface AutoDeps {
  bridge: PageBridge;
  cache: ContentCache;
  observer: ContentObserver;
}

interface AutoJob {
  msgId: string;
  base64: string;
  mimeType: string;
  chatId: string;
  chatName: string;
}

const MILLISECOND_TIMESTAMP_THRESHOLD = 1e12;
const DEFAULT_MIME_TYPE = "audio/ogg";
const QUEUE_DELAY_MS = 600;
const CHAT_INFO_TIMEOUT_MS = 8000;
const AUTO_FIELDS: readonly string[] = [
  "autoMode",
  "autoContacts",
  "autoGroups",
  "autoChannels",
];

export function chatKindOf(chatId: string): ChatKind {
  const id = chatId.toLowerCase();
  if (id.includes("@newsletter")) return "channels";
  if (id.includes("@g.us")) return "groups";
  return "contacts";
}

function timestampSeconds(value: number): number {
  if (!value) return 0;
  return value > MILLISECOND_TIMESTAMP_THRESHOLD ? Math.floor(value / 1000) : value;
}

export function shouldTranscribeAuto(input: AutoDecisionInput): boolean {
  if (input.settings.mode === "off") return false;
  if (input.alreadyAttempted || input.cached) return false;
  if (
    input.settings.mode === "chat" &&
    input.activeChatId &&
    input.chatId &&
    input.chatId !== input.activeChatId
  ) {
    return false;
  }
  if (!input.settings[chatKindOf(input.chatId)]) return false;
  const timestamp = timestampSeconds(input.timestamp);
  if (!timestamp) return false;
  return timestamp >= input.nowSeconds - AUTO_RECENCY_TOLERANCE_SECONDS;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function readAutoSettings(): Promise<AutoSettings> {
  const stored = await readStoredSettings();
  return {
    mode: stored.autoMode,
    contacts: stored.autoContacts,
    groups: stored.autoGroups,
    channels: stored.autoChannels,
  };
}

export function createAutoTranscription(deps: AutoDeps): AutoController {
  let settings: AutoSettings = { mode: "off", contacts: true, groups: true, channels: false };
  let activeChatId = "";
  let activeChatMsgId = "";
  let backfillBusy = false;
  let running = false;
  const attempted = new Set<string>();
  const queue: AutoJob[] = [];

  function notifyWatch(): void {
    deps.bridge.post({
      type: "AUTO_WATCH",
      mode: settings.mode,
      contacts: settings.contacts,
      groups: settings.groups,
      channels: settings.channels,
    });
  }

  async function reload(): Promise<void> {
    settings = await readAutoSettings();
    notifyWatch();
    log.info("auto", `Transcrição automática: ${settings.mode}`);
  }

  function handleStorageChange(
    changes: Record<string, unknown>,
    area: string,
  ): void {
    if (area !== "local") return;
    if (!AUTO_FIELDS.some((field) => field in changes)) return;
    void reload().catch(() => undefined);
  }

  function start(): void {
    void reload().catch(() => undefined);
    ext.storage.onChanged.addListener(handleStorageChange);
  }

  async function processQueue(): Promise<void> {
    if (running) return;
    const job = queue.shift();
    if (!job) return;
    if (deps.cache.lookup(job.msgId)) {
      void processQueue();
      return;
    }
    running = true;
    try {
      const outcome = await requestTranscription(job.base64, job.mimeType);
      if (!outcome.ok) {
        log.error("auto", "Falha na transcrição automática", outcome.error);
        return;
      }
      const text = outcome.text || t("noSpeech");
      deps.cache.store(job.msgId, text, job.chatId, job.chatName);
      deps.observer.applyTranscript(job.msgId, text, false);
      log.info(
        "auto",
        `Transcrição automática pronta (${outcome.provider || "provedor"})`,
        `${text.length} caracteres`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("auto", "Exceção na transcrição automática", message);
    } finally {
      window.setTimeout(() => {
        running = false;
        void processQueue();
      }, QUEUE_DELAY_MS);
    }
  }

  function handleAudio(payload: AutoAudioPayload): void {
    if (!payload.msgId || !payload.base64) return;
    const msgId = payload.msgId;
    const decision = shouldTranscribeAuto({
      settings,
      chatId: payload.chatId,
      activeChatId,
      timestamp: payload.timestamp,
      nowSeconds: nowSeconds(),
      alreadyAttempted: attempted.has(msgId),
      cached: deps.cache.lookup(msgId) !== null,
    });
    if (!decision) return;
    attempted.add(msgId);
    queue.push({
      msgId,
      base64: payload.base64,
      mimeType: payload.mimeType || DEFAULT_MIME_TYPE,
      chatId: payload.chatId,
      chatName: payload.chatName,
    });
    log.info("auto", "Áudio novo recebido; na fila para transcrição automática", msgId);
    void processQueue();
  }

  function backfillChatInfo(): void {
    if (backfillBusy) return;
    const missing = deps.cache.missingChatInfo(deps.observer.msgIds());
    const first = missing[0];
    if (first === undefined) return;
    backfillBusy = true;
    void deps.bridge.pageRequest({ type: "CHAT_INFO", msgId: first }, CHAT_INFO_TIMEOUT_MS).then((response) => {
      backfillBusy = false;
      if (!response.ok || !isChatInfo(response.payload)) return;
      const info = response.payload;
      if (!info.chatId && !info.chatName) return;
      if (deps.cache.applyChatInfo(missing, info)) log.info("cache", "Nome da conversa salvo no cache");
    });
  }

  function syncActiveChat(): void {
    const firstId = deps.observer.msgIds()[0] ?? "";
    if (!firstId) {
      if (activeChatId || activeChatMsgId) {
        activeChatId = "";
        activeChatMsgId = "";
        notifyWatch();
      }
      return;
    }
    if (firstId === activeChatMsgId) return;
    activeChatMsgId = firstId;
    void deps.bridge.pageRequest({ type: "CHAT_INFO", msgId: firstId }, CHAT_INFO_TIMEOUT_MS).then((response) => {
      if (activeChatMsgId !== firstId) return;
      const chatId = response.ok && isChatInfo(response.payload) ? response.payload.chatId : "";
      if (chatId !== activeChatId) {
        activeChatId = chatId;
        notifyWatch();
      }
    });
  }

  return { start, handleAudio, notifyWatch, backfillChatInfo, syncActiveChat };
}
