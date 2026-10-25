import type { ProviderId } from "./types";

export const TRANSCRIBE_AUDIO = "TRANSCRIBE_AUDIO";
export const LOCAL_WHISPER_TRANSCRIBE = "LOCAL_WHISPER_TRANSCRIBE";
export const LOCAL_WHISPER_PRELOAD = "LOCAL_WHISPER_PRELOAD";
export const OFFSCREEN_PING = "OFFSCREEN_PING";
export const PRELOAD_LOCAL_MODEL = "PRELOAD_LOCAL_MODEL";
export const CACHE_CLEARED = "CACHE_CLEARED";

export const CACHE_KEY = "waTrCache";

export interface TranscribeAudioRequest {
  type: typeof TRANSCRIBE_AUDIO;
  audioBase64: string;
  mimeType: string;
}

export interface TranscribeAudioSuccess {
  ok: true;
  text: string;
  languageCode: string | null;
  confidence: number | null;
  provider: ProviderId;
}

export interface TranscribeAudioFailure {
  ok: false;
  error: string;
  provider: string;
}

export type TranscribeAudioResponse = TranscribeAudioSuccess | TranscribeAudioFailure;

export interface LocalWhisperRequest {
  type: typeof LOCAL_WHISPER_TRANSCRIBE;
  audioBase64: string;
  mimeType: string;
  model: string;
  language: string;
}

export interface LocalWhisperReplySuccess {
  ok: true;
  text: string;
  language: string | null;
}

export interface LocalWhisperReplyFailure {
  ok: false;
  error: string;
}

export type LocalWhisperReply = LocalWhisperReplySuccess | LocalWhisperReplyFailure;

export function isLocalWhisperReply(value: unknown): value is LocalWhisperReply {
  if (!isRecord(value)) return false;
  if (value.ok === true) return typeof value.text === "string";
  if (value.ok === false) return typeof value.error === "string";
  return false;
}

export interface LocalWhisperPreloadRequest {
  type: typeof LOCAL_WHISPER_PRELOAD;
  model: string;
}

export interface PreloadLocalModelRequest {
  type: typeof PRELOAD_LOCAL_MODEL;
  model: string;
}

export interface CacheClearedMessage {
  type: typeof CACHE_CLEARED;
  scope: "chat" | "all";
  chatId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isTranscribeAudioRequest(value: unknown): value is TranscribeAudioRequest {
  if (!isRecord(value)) return false;
  return (
    value.type === TRANSCRIBE_AUDIO &&
    typeof value.audioBase64 === "string" &&
    value.audioBase64.length > 0 &&
    typeof value.mimeType === "string"
  );
}

export function isLocalWhisperRequest(value: unknown): value is LocalWhisperRequest {
  if (!isRecord(value)) return false;
  return (
    value.type === LOCAL_WHISPER_TRANSCRIBE &&
    typeof value.audioBase64 === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.model === "string" &&
    typeof value.language === "string"
  );
}

export function isPreloadLocalModel(value: unknown): value is PreloadLocalModelRequest {
  if (!isRecord(value)) return false;
  return value.type === PRELOAD_LOCAL_MODEL && typeof value.model === "string" && value.model.length > 0;
}

export function isOffscreenPing(value: unknown): value is { type: typeof OFFSCREEN_PING } {
  if (!isRecord(value)) return false;
  return value.type === OFFSCREEN_PING;
}

export function isLocalWhisperPreload(value: unknown): value is LocalWhisperPreloadRequest {
  if (!isRecord(value)) return false;
  return value.type === LOCAL_WHISPER_PRELOAD && typeof value.model === "string" && value.model.length > 0;
}

export function isCacheClearedMessage(value: unknown): value is CacheClearedMessage {
  if (!isRecord(value)) return false;
  if (value.type !== CACHE_CLEARED) return false;
  if (value.scope !== "chat" && value.scope !== "all") return false;
  return typeof value.chatId === "string";
}
