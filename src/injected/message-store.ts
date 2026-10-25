import { AUTO_RECENCY_TOLERANCE_SECONDS, PAGE_SOURCE } from "@/shared/types";
import type { AutoAudioPayload, AutoMode, PageResponse } from "@/shared/types";
import type { PageLog } from "./bridge";
import { chatInfoFor, widToString } from "./chat-info";
import { downloadAudio, toCapturedAudio } from "./download";
import { errorText } from "./whatsapp/modules";
import type { WhatsAppModules } from "./whatsapp/modules";
import { isMessageModel, messageType } from "./whatsapp/types";
import type { ModelCollection, WhatsAppMessage } from "./whatsapp/types";

const POLL_INTERVAL_MS = 4000;
const START_POLL_INTERVAL_MS = 2000;
const SEEN_LIMIT = 5000;
const SEEN_KEEP = 2000;
const MILLISECOND_TIMESTAMP_THRESHOLD = 1e12;

export interface AutoWatchScope {
  contacts: boolean;
  groups: boolean;
  channels: boolean;
}

export type ChatKind = keyof AutoWatchScope;

export interface AutoWatchConfig {
  mode: AutoMode;
  scope: AutoWatchScope;
}

export interface AutoWatchInput extends AutoWatchScope {
  mode: AutoMode;
}

export function chatKindOf(chatId: string): ChatKind {
  const id = chatId.toLowerCase();
  if (id.includes("@newsletter")) return "channels";
  if (id.includes("@g.us")) return "groups";
  return "contacts";
}

export function shouldAutoCapture(config: AutoWatchConfig, chatId: string): boolean {
  if (config.mode === "off") return false;
  return config.scope[chatKindOf(chatId)];
}

function timestampSeconds(message: WhatsAppMessage): number {
  const timestamp = Number(message.t) || 0;
  if (!timestamp) return 0;
  return timestamp > MILLISECOND_TIMESTAMP_THRESHOLD ? Math.floor(timestamp / 1000) : timestamp;
}

export function isRecentEnough(message: WhatsAppMessage, startedAt: number): boolean {
  const timestamp = timestampSeconds(message);
  if (!timestamp) return false;
  return timestamp >= startedAt - AUTO_RECENCY_TOLERANCE_SECONDS;
}

function isVoiceMessage(message: WhatsAppMessage): boolean {
  const type = messageType(message);
  return type === "ptt" || type === "audio";
}

function messageIdOf(message: WhatsAppMessage): string {
  const id = message.id;
  if (!id) return "";
  if (id.id) return id.id;
  return widToString(id);
}

interface VoiceMessageRef {
  message: WhatsAppMessage;
  id: string;
}

export interface MessageMonitorDeps {
  modules: WhatsAppModules;
  log: PageLog;
  post: (message: PageResponse) => void;
}

export interface MessageMonitor {
  start(): void;
  configure(input: AutoWatchInput): void;
}

export function createMessageMonitor(deps: MessageMonitorDeps): MessageMonitor {
  const config: AutoWatchConfig = { mode: "off", scope: { contacts: true, groups: true, channels: false } };
  const processed = new Set<string>();
  let seenIds: Set<string> | null = null;
  let startedAt = 0;
  let started = false;
  let startTimer: number | undefined;

  function readModels(collection: ModelCollection): unknown[] {
    try {
      const models = collection.getModelsArray?.();
      return Array.isArray(models) ? models : [];
    } catch {
      return [];
    }
  }

  function voiceMessagesNow(): VoiceMessageRef[] {
    const collection = deps.modules.getCollection();
    if (!collection) return [];
    const list: VoiceMessageRef[] = [];
    for (const model of readModels(collection)) {
      if (!isMessageModel(model)) continue;
      if (!isVoiceMessage(model)) continue;
      const id = messageIdOf(model);
      if (id) list.push({ message: model, id });
    }
    return list;
  }

  function trimmedSeen(list: readonly VoiceMessageRef[]): Set<string> {
    const keep = new Set<string>();
    for (let index = Math.max(0, list.length - SEEN_KEEP); index < list.length; index += 1) {
      const item = list[index];
      if (item) keep.add(item.id);
    }
    return keep;
  }

  function scanNewVoiceMessages(onNew: ((message: WhatsAppMessage, id: string) => void) | null): void {
    const list = voiceMessagesNow();
    if (!deps.modules.getCollection()) return;
    const seen = seenIds;
    if (seen === null) {
      const baseline = new Set(list.map((item) => item.id));
      seenIds = baseline;
      deps.log("info", "auto", `Linha de base: ${String(baseline.size)} áudios já existentes`);
      return;
    }
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (onNew) onNew(item.message, item.id);
    }
    if (seen.size > SEEN_LIMIT) seenIds = trimmedSeen(list);
  }

  async function handleAutoMessage(message: WhatsAppMessage, id: string): Promise<void> {
    if (config.mode === "off") return;
    if (!isRecentEnough(message, startedAt)) return;
    const info = chatInfoFor(message, deps.modules);
    if (!shouldAutoCapture(config, info.chatId)) {
      deps.log("info", "auto", `Ignorado pelas regras (${info.chatId || "?"})`);
      return;
    }
    if (processed.has(id)) return;
    processed.add(id);
    try {
      const result = await downloadAudio({ modules: deps.modules, log: deps.log }, id, message);
      const audio = await toCapturedAudio(result.blob);
      const payload: AutoAudioPayload = {
        ...audio,
        msgId: id,
        timestamp: timestampSeconds(message),
        chatId: result.chatId,
        chatName: result.chatName,
      };
      deps.post({ source: PAGE_SOURCE, type: "AUTO_AUDIO", audio: payload });
      deps.log("info", "auto", `Áudio novo baixado e enviado para transcrição (${id})`);
    } catch (error) {
      deps.log("warn", "auto", `Falha ao baixar áudio novo ${id}: ${errorText(error)}`);
    }
  }

  function handleAddedModel(model: unknown): void {
    if (!isMessageModel(model)) return;
    if (!isVoiceMessage(model)) return;
    const id = messageIdOf(model);
    if (!id) return;
    if (seenIds?.has(id)) return;
    seenIds ??= new Set<string>();
    seenIds.add(id);
    if (config.mode !== "off") void handleAutoMessage(model, id);
  }

  function pollNewVoiceMessages(): void {
    scanNewVoiceMessages((message, id) => {
      if (config.mode !== "off") void handleAutoMessage(message, id);
    });
  }

  function attachAddListener(collection: ModelCollection): void {
    if (typeof collection.on !== "function") {
      deps.log("warn", "auto", "Coleção sem evento add; usando polling");
      return;
    }
    try {
      collection.on("add", handleAddedModel);
      deps.log("info", "auto", "Monitor de mensagens via evento (add)");
    } catch (error) {
      deps.log("warn", "auto", `Coleção sem evento add; usando polling (${errorText(error)})`);
    }
  }

  function tryStart(): void {
    if (started) return;
    const collection = deps.modules.getCollection();
    if (!collection) return;
    started = true;
    startedAt = Math.floor(Date.now() / 1000);
    scanNewVoiceMessages(null);
    attachAddListener(collection);
    window.setInterval(pollNewVoiceMessages, POLL_INTERVAL_MS);
    const state = config.mode === "off" ? "desligada" : "ligada";
    deps.log("info", "auto", `Monitor de áudios novos ativo (transcrição automática ${state})`);
  }

  function start(): void {
    if (startTimer !== undefined) return;
    startTimer = window.setInterval(tryStart, START_POLL_INTERVAL_MS);
    tryStart();
  }

  function configure(input: AutoWatchInput): void {
    config.mode = input.mode;
    config.scope = { contacts: input.contacts, groups: input.groups, channels: input.channels };
    const scope = [input.contacts ? "contatos" : "", input.groups ? "grupos" : "", input.channels ? "canais" : ""]
      .filter(Boolean)
      .join(", ");
    deps.log("info", "auto", `Monitor: ${input.mode === "off" ? "desligado" : input.mode} | tipos: ${scope}`);
  }

  return { start, configure };
}
