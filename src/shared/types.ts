export const PROVIDER_IDS = ["assemblyai", "openai", "gemini", "local"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type CloudProviderId = Exclude<ProviderId, "local">;

export const LOCALE_IDS = ["en", "pt-BR", "pt-PT", "es", "fr", "it", "ru"] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export type UiLanguageSetting = "auto" | LocaleId;

export type LanguageMode = "auto" | "manual";

export type AutoMode = "off" | "chat" | "all";

export type Theme = "light" | "dark";

export type LogLevel = "info" | "warn" | "error";

export interface ExtensionSettings {
  provider: ProviderId;
  languageMode: LanguageMode;
  languageCode: string;
  autoMode: AutoMode;
  autoContacts: boolean;
  autoGroups: boolean;
  autoChannels: boolean;
  uiLanguage: UiLanguageSetting;
  panelTheme: Theme | null;
  keys: Record<CloudProviderId, string>;
  models: Record<ProviderId, string>;
}

export interface CacheEntry {
  text: string;
  ts: number;
  chatId: string;
  chatName: string;
}

export type CacheStore = Record<string, CacheEntry>;

export interface ChatInfo {
  chatId: string;
  chatName: string;
}

export interface TranscriptionResult {
  text: string;
  languageCode: string | null;
  confidence: number | null;
  provider: ProviderId;
}

export interface CapturedAudio {
  base64: string;
  mimeType: string;
  size: number;
}

export interface PageRequestPayloads {
  PING: Record<string, never>;
  DOWNLOAD_AUDIO: { msgId: string };
  CHAT_INFO: { msgId: string };
  AUTO_WATCH: {
    mode: AutoMode;
    contacts: boolean;
    groups: boolean;
    channels: boolean;
  };
}

export interface PageResponsePayloads {
  DOWNLOAD_AUDIO: CapturedAudio;
  CHAT_INFO: ChatInfo;
}

export type PageRequestType = keyof PageRequestPayloads;
export type PageResponseType = keyof PageResponsePayloads;

export type PageRequest = {
  [Type in PageRequestType]: {
    source: typeof CONTENT_SOURCE;
    type: Type;
    requestId: string;
  } & PageRequestPayloads[Type];
}[PageRequestType];

export type PageResponse =
  | { source: typeof PAGE_SOURCE; type: "READY"; version: string }
  | { source: typeof PAGE_SOURCE; type: "PONG" }
  | { source: typeof PAGE_SOURCE; type: "LOG"; level: LogLevel; tag: string; message: string }
  | { source: typeof PAGE_SOURCE; type: "AUTO_AUDIO"; audio: AutoAudioPayload }
  | { source: typeof PAGE_SOURCE; type: "RESPONSE"; requestId: string; ok: true; payload: unknown }
  | { source: typeof PAGE_SOURCE; type: "RESPONSE"; requestId: string; ok: false; error: string };

export interface AutoAudioPayload extends CapturedAudio, ChatInfo {
  msgId: string;
  timestamp: number;
}

export const CONTENT_SOURCE = "wa-transcriber-content";
export const PAGE_SOURCE = "wa-transcriber-page";

export const MAX_CACHE_ENTRIES = 500;
export const AUTO_RECENCY_TOLERANCE_SECONDS = 60;
