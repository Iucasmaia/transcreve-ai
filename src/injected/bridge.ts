import { CONTENT_SOURCE, PAGE_SOURCE } from "@/shared/types";
import type { LogLevel, PageRequest, PageResponse } from "@/shared/types";
import { resolveChatInfo } from "./chat-info";
import { downloadAudio, toCapturedAudio } from "./download";
import type { MessageMonitor } from "./message-store";
import { StageError, errorText } from "./whatsapp/modules";
import type { WhatsAppModules } from "./whatsapp/modules";
import { readProperty } from "./whatsapp/types";

const REQUEST_TYPES = ["PING", "DOWNLOAD_AUDIO", "CHAT_INFO", "AUTO_WATCH"] as const;
const UNKNOWN_ERROR_CODE_PREFIX = "erro-";
const UNKNOWN_ERROR_CODE_LENGTH = 50;

export type PageLog = (level: LogLevel, tag: string, message: string) => void;

export interface BridgeDeps {
  version: string;
  post: (message: PageResponse) => void;
  log: PageLog;
  modules: WhatsAppModules;
  monitor: MessageMonitor;
}

export interface PageBridge {
  attach(): void;
  announceReady(): void;
}

export function createPageLog(post: (message: PageResponse) => void): PageLog {
  return (level, tag, message) => {
    post({ source: PAGE_SOURCE, type: "LOG", level, tag, message });
  };
}

export function createBridge(deps: BridgeDeps): PageBridge {
  function stageCode(error: unknown): string {
    if (error instanceof StageError) return error.stage;
    return `${UNKNOWN_ERROR_CODE_PREFIX}${errorText(error).slice(0, UNKNOWN_ERROR_CODE_LENGTH)}`;
  }

  function succeed(requestId: string, payload: unknown): void {
    deps.post({ source: PAGE_SOURCE, type: "RESPONSE", requestId, ok: true, payload });
  }

  function fail(requestId: string, error: unknown): void {
    deps.post({ source: PAGE_SOURCE, type: "RESPONSE", requestId, ok: false, error: `stage:${stageCode(error)}` });
  }

  async function handleDownloadRequest(requestId: string, msgId: string): Promise<void> {
    try {
      const result = await downloadAudio({ modules: deps.modules, log: deps.log }, msgId);
      succeed(requestId, await toCapturedAudio(result.blob));
    } catch (error) {
      deps.log("error", "download", `Falhou: ${stageCode(error)}`);
      fail(requestId, error);
    }
  }

  async function handleChatInfoRequest(requestId: string, msgId: string): Promise<void> {
    try {
      succeed(requestId, await resolveChatInfo(deps.modules, msgId));
    } catch (error) {
      fail(requestId, error);
    }
  }

  function handleRequest(request: PageRequest): void {
    switch (request.type) {
      case "PING":
        deps.post({ source: PAGE_SOURCE, type: "PONG" });
        return;
      case "AUTO_WATCH":
        deps.monitor.configure({
          mode: request.mode,
          contacts: request.contacts,
          groups: request.groups,
          channels: request.channels,
        });
        return;
      case "CHAT_INFO":
        void handleChatInfoRequest(request.requestId, request.msgId);
        return;
      case "DOWNLOAD_AUDIO":
        void handleDownloadRequest(request.requestId, request.msgId);
        return;
    }
  }

  function handleMessage(event: MessageEvent): void {
    if (event.source !== window) return;
    const data: unknown = event.data;
    if (readProperty(data, "source") !== CONTENT_SOURCE) return;
    if (!isPageRequest(data)) return;
    handleRequest(data);
  }

  return {
    attach(): void {
      window.addEventListener("message", handleMessage);
    },
    announceReady(): void {
      deps.post({ source: PAGE_SOURCE, type: "READY", version: deps.version });
      deps.log("info", "init", `Script de página ativo (v${deps.version}, mundo MAIN)`);
    },
  };
}

function isPageRequest(value: unknown): value is PageRequest {
  const type = readProperty(value, "type");
  if (typeof type !== "string") return false;
  return REQUEST_TYPES.some((candidate) => candidate === type);
}
