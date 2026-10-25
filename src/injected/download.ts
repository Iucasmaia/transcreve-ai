import type { CapturedAudio } from "@/shared/types";
import type { PageLog } from "./bridge";
import { chatInfoFor } from "./chat-info";
import { StageError, errorText, findDownloadFunction } from "./whatsapp/modules";
import type { FoundDownloadFunction, WhatsAppModules } from "./whatsapp/modules";
import { messageSources, pickField, readProperty } from "./whatsapp/types";
import type { BlobCache, DownloadManagerParams, WhatsAppMessage } from "./whatsapp/types";

const DEFAULT_MIME_TYPE = "audio/ogg";
const DEFAULT_DOWNLOAD_TYPE = "ptt";
const CDN_BASE_URL = "https://mmg.whatsapp.net";
const HKDF_INFO = "WhatsApp Audio Keys";
const MAC_LENGTH = 10;

export interface DownloadContext {
  modules: WhatsAppModules;
  log: PageLog;
}

export interface DownloadedAudio {
  blob: Blob;
  chatId: string;
  chatName: string;
}

type ByteArray = Uint8Array<ArrayBuffer>;

type DownloadStrategy = (context: DownloadContext, message: WhatsAppMessage) => Promise<Blob | null>;

function mimeTypeOf(message: WhatsAppMessage): string {
  return typeof message.mimetype === "string" && message.mimetype ? message.mimetype : DEFAULT_MIME_TYPE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  const expired = new Promise<never>((_resolve, reject) => {
    window.setTimeout(() => {
      reject(new StageError("timeout"));
    }, timeoutMs);
  });
  return Promise.race([work, expired]);
}

function copyView(view: ArrayBufferView): ByteArray {
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return bytes;
}

function forceBlob(value: unknown): Blob | null {
  const forceToBlob = readProperty(value, "forceToBlob");
  if (typeof forceToBlob !== "function") return null;
  try {
    const forced: unknown = forceToBlob.call(value);
    return forced instanceof Blob ? forced : null;
  } catch {
    return null;
  }
}

function normalizeBlob(value: unknown, mimeType: string): Blob | null {
  if (!value) return null;
  if (value instanceof Blob) return value;
  const forced = forceBlob(value);
  if (forced) return forced;
  if (value instanceof ArrayBuffer) return new Blob([value], { type: mimeType });
  if (ArrayBuffer.isView(value)) return new Blob([copyView(value)], { type: mimeType });
  const blob = readProperty(value, "blob");
  if (blob instanceof Blob) return blob;
  const internalBlob = readProperty(value, "_blob");
  if (internalBlob instanceof Blob) return internalBlob;
  return null;
}

function readCachedBlob(cache: BlobCache, key: unknown, mimeType: string): Blob | null {
  try {
    return normalizeBlob(cache.get?.(key), mimeType);
  } catch {
    return null;
  }
}

function extractBlob(modules: WhatsAppModules, message: WhatsAppMessage): Blob | null {
  const mimeType = mimeTypeOf(message);
  const filehash = pickField(messageSources(message), "filehash");
  const cache = modules.getBlobCache();
  if (cache && filehash) {
    const cached = readCachedBlob(cache, filehash, mimeType);
    if (cached) return cached;
  }
  return normalizeBlob(message.mediaObject?.mediaBlob, mimeType);
}

function concatBytes(...parts: readonly ByteArray[]): ByteArray {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function hmacSha256(keyBytes: ByteArray, data: BufferSource): Promise<ByteArray> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

async function hkdfExpand(inputKeyMaterial: ByteArray, info: string, length: number): Promise<ByteArray> {
  const pseudoRandomKey = await hmacSha256(new Uint8Array(32), inputKeyMaterial);
  const infoBytes = new TextEncoder().encode(info);
  const blocks: ByteArray[] = [];
  let previous = new Uint8Array(0);
  let produced = 0;
  let counter = 1;
  while (produced < length) {
    previous = await hmacSha256(pseudoRandomKey, concatBytes(previous, infoBytes, new Uint8Array([counter])));
    blocks.push(previous);
    produced += previous.length;
    counter += 1;
  }
  return concatBytes(...blocks).slice(0, length);
}

async function decryptMedia(encrypted: ArrayBuffer, mediaKeyBytes: ByteArray): Promise<ArrayBuffer> {
  const keys = await hkdfExpand(mediaKeyBytes, HKDF_INFO, 112);
  const iv = keys.slice(0, 16);
  const cipherKey = keys.slice(16, 48);
  const macKey = keys.slice(48, 80);

  const bytes = new Uint8Array(encrypted);
  if (bytes.length <= MAC_LENGTH) throw new StageError("decrypt-arquivo-invalido");
  const data = bytes.slice(0, bytes.length - MAC_LENGTH);
  const mac = bytes.slice(bytes.length - MAC_LENGTH);

  const signature = await hmacSha256(macKey, concatBytes(iv, data));
  for (let index = 0; index < MAC_LENGTH; index += 1) {
    if (signature[index] !== mac[index]) throw new StageError("decrypt-mac-invalido");
  }

  const aesKey = await crypto.subtle.importKey("raw", cipherKey, { name: "AES-CBC" }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, data);
}

function decodeBase64(value: string): ByteArray | null {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function toKeyBytes(value: unknown): ByteArray | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return copyView(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  if (typeof value === "string") return decodeBase64(value);
  const data = readProperty(value, "data");
  return Array.isArray(data) ? new Uint8Array(data) : null;
}

async function strategyDownloadMedia(context: DownloadContext, message: WhatsAppMessage): Promise<Blob | null> {
  if (typeof message.downloadMedia !== "function") {
    context.log("info", "s1", "msg.downloadMedia indisponível; pulando S1");
    return null;
  }
  const mediaStageBefore = message.mediaData?.mediaStage;
  const stageBefore = typeof mediaStageBefore === "string" && mediaStageBefore ? mediaStageBefore : "?";
  context.log("info", "s1", `Chamando msg.downloadMedia() (mediaStage antes: ${stageBefore})`);

  const cached = extractBlob(context.modules, message);
  if (cached) {
    context.log("info", "s1", `Blob já estava em cache: ${String(cached.size)} bytes`);
    return cached;
  }

  const options = { downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true };
  await withTimeout(Promise.resolve(message.downloadMedia(options)), 45000);

  const mediaStageAfter = message.mediaData?.mediaStage;
  const stageAfter = typeof mediaStageAfter === "string" ? mediaStageAfter : "";
  context.log("info", "s1", `downloadMedia concluído (mediaStage depois: ${stageAfter || "?"})`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const blob = extractBlob(context.modules, message);
    if (blob) {
      context.log("info", "s1", `Blob obtido do cache: ${String(blob.size)} bytes (${blob.type || "?"})`);
      return blob;
    }
    await sleep(500);
  }
  if (stageAfter.includes("ERROR")) throw new StageError("download-falhou");
  context.log("warn", "s1", "Blob não apareceu no cache após o download");
  return null;
}

async function strategyDownloadManager(context: DownloadContext, message: WhatsAppMessage): Promise<Blob | null> {
  const manager = context.modules.getDownloadManager();
  if (!manager) {
    context.log("info", "s2", "WAWebDownloadManager indisponível; pulando S2");
    return null;
  }

  const holders: unknown[] = [];
  const nested = readProperty(manager, "downloadManager");
  if (nested) holders.push(nested);
  holders.push(manager);
  const fallback = readProperty(manager, "default");
  if (fallback) holders.push(fallback);

  let found: FoundDownloadFunction | undefined;
  for (const holder of holders) {
    found = findDownloadFunction(holder);
    if (found) break;
  }
  if (!found) {
    context.log("warn", "s2", "Nenhuma função de download encontrada no DownloadManager");
    return null;
  }
  context.log("info", "s2", `Usando DownloadManager.${found.name}()`);

  const sources = messageSources(message);
  const type = pickField(sources, "type");
  const params: DownloadManagerParams = {
    directPath: pickField(sources, "directPath"),
    encFilehash: pickField(sources, "encFilehash"),
    filehash: pickField(sources, "filehash"),
    mediaKey: pickField(sources, "mediaKey"),
    mediaKeyTimestamp: pickField(sources, "mediaKeyTimestamp"),
    type: typeof type === "string" && type ? type : DEFAULT_DOWNLOAD_TYPE,
  };
  const present = (value: unknown): string => (value ? "sim" : "NÃO");
  context.log(
    "info",
    "s2",
    `Parâmetros: directPath=${present(params.directPath)}, mediaKey=${present(params.mediaKey)}, filehash=${present(params.filehash)}`,
  );

  const result = await withTimeout(Promise.resolve(found.fn.call(found.holder, params)), 45000);
  const blob = normalizeBlob(result, mimeTypeOf(message));
  if (blob) {
    context.log("info", "s2", `Blob obtido: ${String(blob.size)} bytes`);
    return blob;
  }
  context.log("warn", "s2", "DownloadManager não retornou um blob utilizável");
  return null;
}

async function strategyManualDecrypt(context: DownloadContext, message: WhatsAppMessage): Promise<Blob> {
  const sources = messageSources(message);
  const directPath = pickField(sources, "directPath");
  const mediaKey = toKeyBytes(pickField(sources, "mediaKey"));
  if (typeof directPath !== "string" || directPath === "" || !mediaKey) {
    context.log(
      "warn",
      "s3",
      `Sem dados para descriptografia manual (directPath=${directPath ? "sim" : "NÃO"}, mediaKey=${mediaKey ? "sim" : "NÃO"})`,
    );
    throw new StageError("decrypt-sem-dados");
  }
  const url = directPath.startsWith("http") ? directPath : `${CDN_BASE_URL}${directPath}`;
  context.log("info", "s3", "Baixando .enc do CDN e descriptografando");

  const response = await withTimeout(fetch(url), 30000);
  if (!response.ok) throw new StageError("decrypt-download-falhou");

  const encrypted = await response.arrayBuffer();
  const plain = await decryptMedia(encrypted, mediaKey);
  const blob = new Blob([plain], { type: mimeTypeOf(message) });
  context.log("info", "s3", `Descriptografia OK: ${String(blob.size)} bytes`);
  return blob;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => {
      reject(new StageError("leitura-falhou"));
    };
    reader.readAsDataURL(blob);
  });
}

export async function toCapturedAudio(blob: Blob): Promise<CapturedAudio> {
  return {
    base64: await blobToBase64(blob),
    mimeType: blob.type || DEFAULT_MIME_TYPE,
    size: blob.size,
  };
}

export async function downloadAudio(
  context: DownloadContext,
  msgId: string,
  resolvedMessage?: WhatsAppMessage,
): Promise<DownloadedAudio> {
  context.log("info", "download", `Iniciando download silencioso de ${msgId}`);
  const ready = await context.modules.ensure(15000);
  if (!ready) throw new StageError("require-indisponivel");
  context.log("info", "download", `Módulos prontos (coleção via ${context.modules.getCollectionLabel()})`);

  const message = resolvedMessage ?? (await context.modules.getMessageAsync(msgId));
  if (!message) throw new StageError("mensagem-nao-encontrada");
  const messageType = pickField(messageSources(message), "type");
  context.log("info", "download", `Mensagem localizada (tipo: ${typeof messageType === "string" ? messageType : "?"})`);

  const info = chatInfoFor(message, context.modules);
  context.log("info", "conversa", `Chat: ${info.chatName || "?"} (${info.chatId || "?"})`);

  const mediaStage = message.mediaData?.mediaStage;
  if (mediaStage === "REUPLOADING") throw new StageError("midia-indisponivel");

  const strategies: readonly (readonly [string, DownloadStrategy])[] = [
    ["s1", strategyDownloadMedia],
    ["s2", strategyDownloadManager],
    ["s3", strategyManualDecrypt],
  ];
  let lastStage = "blob-indisponivel";
  for (const [name, strategy] of strategies) {
    try {
      const blob = await strategy(context, message);
      if (blob && blob.size > 0) {
        context.log("info", "download", `Sucesso via ${name}: ${String(blob.size)} bytes`);
        return { blob, chatId: info.chatId, chatName: info.chatName };
      }
    } catch (error) {
      if (error instanceof StageError) lastStage = error.stage;
      context.log("warn", name, `Estratégia falhou (${error instanceof StageError ? error.stage : errorText(error)})`);
    }
  }
  throw new StageError(lastStage);
}
