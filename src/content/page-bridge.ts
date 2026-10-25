import { log } from "@/shared/logger";
import {
  CONTENT_SOURCE,
  PAGE_SOURCE,
  type AutoAudioPayload,
  type CapturedAudio,
  type ChatInfo,
  type LogLevel,
  type PageRequestPayloads,
  type PageRequestType,
} from "@/shared/types";

export type RequestInput = {
  [Type in PageRequestType]: { type: Type } & PageRequestPayloads[Type];
}[PageRequestType];

export type PageResult = { ok: true; payload: unknown } | { ok: false; error: string };

export interface PageBridge {
  pageRequest(input: RequestInput, timeoutMs: number): Promise<PageResult>;
  ensurePageAlive(timeoutMs: number): Promise<boolean>;
  post(input: RequestInput): void;
}

export interface PageBridgeDeps {
  onAutoAudio(audio: AutoAudioPayload): void;
  onReady(): void;
}

const MESSAGE_ORIGIN = "*";
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const DEFAULT_ALIVE_TIMEOUT_MS = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCapturedAudio(value: unknown): value is CapturedAudio {
  if (!isRecord(value)) return false;
  return (
    typeof value.base64 === "string" &&
    value.base64.length > 0 &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number"
  );
}

export function isChatInfo(value: unknown): value is ChatInfo {
  if (!isRecord(value)) return false;
  return typeof value.chatId === "string" && typeof value.chatName === "string";
}

function isAutoAudioPayload(value: unknown): value is AutoAudioPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.base64 === "string" &&
    value.base64.length > 0 &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    typeof value.msgId === "string" &&
    typeof value.timestamp === "number" &&
    typeof value.chatId === "string" &&
    typeof value.chatName === "string"
  );
}

function toRequest(input: RequestInput, requestId: string): Record<string, unknown> {
  switch (input.type) {
    case "PING":
      return { source: CONTENT_SOURCE, type: "PING", requestId };
    case "DOWNLOAD_AUDIO":
      return { source: CONTENT_SOURCE, type: "DOWNLOAD_AUDIO", requestId, msgId: input.msgId };
    case "CHAT_INFO":
      return { source: CONTENT_SOURCE, type: "CHAT_INFO", requestId, msgId: input.msgId };
    case "AUTO_WATCH":
      return {
        source: CONTENT_SOURCE,
        type: "AUTO_WATCH",
        requestId,
        mode: input.mode,
        contacts: input.contacts,
        groups: input.groups,
        channels: input.channels,
      };
  }
}

function emitLog(level: LogLevel, tag: string, message: string): void {
  if (level === "error") log.error(tag, message);
  else if (level === "warn") log.warn(tag, message);
  else log.info(tag, message);
}

function isLogPayload(
  data: Record<string, unknown>,
): data is { level: LogLevel; tag: string; message: string } {
  const level = data.level;
  const validLevel = level === "info" || level === "warn" || level === "error";
  return validLevel && typeof data.tag === "string" && typeof data.message === "string";
}

export function createPageBridge(deps: PageBridgeDeps): PageBridge {
  const pending = new Map<string, (result: PageResult) => void>();
  let waiters: (() => void)[] = [];
  let requestSeq = 0;
  let pageAlive = false;

  function resolveWaiters(): void {
    const current = waiters;
    waiters = [];
    for (const waiter of current) waiter();
  }

  function resolveResponse(data: Record<string, unknown>): void {
    const requestId = data.requestId;
    if (typeof requestId !== "string") return;
    const handler = pending.get(requestId);
    if (!handler) return;
    pending.delete(requestId);
    pageAlive = true;
    if (data.ok === true) handler({ ok: true, payload: data.payload });
    else handler({ ok: false, error: typeof data.error === "string" ? data.error : "stage:desconhecido" });
  }

  function handleMessage(event: MessageEvent): void {
    if (event.source !== window) return;
    const data: unknown = event.data;
    if (!isRecord(data) || data.source !== PAGE_SOURCE) return;
    const type = data.type;
    if (type === "LOG") {
      if (isLogPayload(data)) {
        pageAlive = true;
        emitLog(data.level, `página/${data.tag}`, data.message);
      }
      return;
    }
    if (type === "AUTO_AUDIO") {
      if (isAutoAudioPayload(data.audio)) {
        pageAlive = true;
        deps.onAutoAudio(data.audio);
      }
      return;
    }
    if (type === "READY" || type === "PONG") {
      pageAlive = true;
      deps.onReady();
      resolveWaiters();
      return;
    }
    if (type === "RESPONSE") resolveResponse(data);
  }

  function pageRequest(input: RequestInput, timeoutMs: number): Promise<PageResult> {
    return new Promise<PageResult>((resolve) => {
      const requestId = `req_${Date.now()}_${++requestSeq}`;
      const timer = window.setTimeout(() => {
        pending.delete(requestId);
        resolve({ ok: false, error: "stage:timeout-resposta" });
      }, timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);
      pending.set(requestId, (result) => {
        window.clearTimeout(timer);
        resolve(result);
      });
      window.postMessage(toRequest(input, requestId), MESSAGE_ORIGIN);
    });
  }

  function ensurePageAlive(timeoutMs: number): Promise<boolean> {
    if (pageAlive) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve(false);
      }, timeoutMs || DEFAULT_ALIVE_TIMEOUT_MS);
      waiters.push(() => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(true);
      });
      window.postMessage(
        { source: CONTENT_SOURCE, type: "PING", requestId: `ping_${Date.now()}` },
        MESSAGE_ORIGIN,
      );
    });
  }

  function post(input: RequestInput): void {
    window.postMessage(toRequest(input, `req_${Date.now()}_${++requestSeq}`), MESSAGE_ORIGIN);
  }

  window.addEventListener("message", handleMessage);

  return { pageRequest, ensurePageAlive, post };
}
