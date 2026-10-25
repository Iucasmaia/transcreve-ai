export interface MessageId {
  id?: string;
  remote?: unknown;
  _remote?: unknown;
  _serialized?: string;
  toString?(): string;
}

export interface ContactModel {
  name?: unknown;
  verifiedName?: unknown;
  pushname?: unknown;
  shortName?: unknown;
}

export interface ChatModel {
  formattedTitle?: unknown;
  name?: unknown;
  contact?: ContactModel;
}

export interface GroupMetadataModel {
  subject?: unknown;
  name?: unknown;
}

export interface MediaObjectModel {
  mediaBlob?: unknown;
}

export interface MediaDataModel {
  mediaStage?: unknown;
}

export interface DownloadMediaOptions {
  downloadEvenIfExpensive?: boolean;
  rmrReason?: number;
  isUserInitiated?: boolean;
}

export interface WhatsAppMessage {
  id?: MessageId;
  t?: unknown;
  type?: unknown;
  isPTT?: unknown;
  mimetype?: string;
  mediaKey?: unknown;
  mediaKeyTimestamp?: unknown;
  directPath?: unknown;
  filehash?: unknown;
  encFilehash?: unknown;
  attributes?: unknown;
  mediaObject?: MediaObjectModel;
  mediaData?: MediaDataModel;
  chat?: ChatModel;
  notifyName?: unknown;
  downloadMedia?(options: DownloadMediaOptions): unknown;
  get?(key: string): unknown;
}

export interface ModelCollection {
  get?(key: string): unknown;
  getMessagesById?(ids: string[]): Promise<unknown>;
  getModelsArray?(): unknown;
  on?(event: string, listener: (model: unknown) => void): unknown;
  _models?: { forEach(callback: (value: unknown, key: unknown) => void): void };
}

export interface MessageModule {
  Msg?: unknown;
  MsgCollection?: unknown;
  get?(key: string): unknown;
}

export interface BlobCache {
  get?(key: unknown): unknown;
}

export type DownloadFunctionName = "downloadAndMaybeDecrypt" | "downloadAndDecrypt" | "download";

export type DownloadFunction = (params: DownloadManagerParams) => unknown;

export type DownloadFunctionHolder = Partial<Record<DownloadFunctionName, DownloadFunction>>;

export interface DownloadManagerParams {
  directPath: unknown;
  encFilehash: unknown;
  filehash: unknown;
  mediaKey: unknown;
  mediaKeyTimestamp: unknown;
  type: string;
}

export interface DownloadManagerModule extends DownloadFunctionHolder {
  downloadManager?: unknown;
  default?: unknown;
}

export interface WhatsAppPageWindow {
  require?(name: string): unknown;
  __waTranscriberPage?: boolean;
}

function isModelObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export function isMessageModel(value: unknown): value is WhatsAppMessage {
  return isModelObject(value);
}

export function isChatModel(value: unknown): value is ChatModel {
  return isModelObject(value);
}

export function isContactModel(value: unknown): value is ContactModel {
  return isModelObject(value);
}

export function isGroupMetadataModel(value: unknown): value is GroupMetadataModel {
  return isModelObject(value);
}

export function readProperty(source: unknown, key: string): unknown {
  if (source === null || (typeof source !== "object" && typeof source !== "function")) {
    return undefined;
  }
  try {
    return (source as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

export function readString(source: unknown, key: string): string {
  const value = readProperty(source, key);
  return typeof value === "string" ? value : "";
}

export function messageSources(message: unknown): readonly unknown[] {
  return [
    message,
    readProperty(message, "attributes"),
    readProperty(message, "mediaObject"),
    readProperty(message, "mediaData"),
  ];
}

export function pickField(sources: readonly unknown[], name: string): unknown {
  for (const source of sources) {
    if (!source) continue;
    const direct = readProperty(source, name);
    if (direct != null) return direct;
    const getter = readProperty(source, "get");
    if (typeof getter !== "function") continue;
    const readViaGet = getter as (key: string) => unknown;
    try {
      const viaGet = readViaGet.call(source, name);
      if (viaGet != null) return viaGet;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function messageType(message: unknown): string {
  const value = pickField(messageSources(message), "type");
  return typeof value === "string" ? value : "";
}
