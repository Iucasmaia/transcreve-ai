import type { PageLog } from "../bridge";
import { isMessageModel, readProperty, readString } from "./types";
import type {
  BlobCache,
  DownloadFunction,
  DownloadFunctionHolder,
  DownloadFunctionName,
  DownloadManagerModule,
  MessageModule,
  ModelCollection,
  WhatsAppMessage,
  WhatsAppPageWindow,
} from "./types";

const COLLECTIONS_MODULE_ID = "WAWebCollections";
const MESSAGE_COLLECTION_MODULE_ID = "WAWebMsgCollection";
const DOWNLOAD_MANAGER_MODULE_ID = "WAWebDownloadManager";
const BLOB_CACHE_MODULE_ID = "WAWebMediaInMemoryBlobCache";
const MESSAGE_COLLECTION_CANDIDATES = [
  { label: "WAWebCollections.Msg", moduleId: COLLECTIONS_MODULE_ID },
  { label: "WAWebMsgCollection", moduleId: MESSAGE_COLLECTION_MODULE_ID },
] as const;
const DOWNLOAD_FUNCTION_NAMES: readonly DownloadFunctionName[] = [
  "downloadAndMaybeDecrypt",
  "downloadAndDecrypt",
  "download",
];
const BOOT_RETRY_DELAYS_MS: readonly number[] = [1200, 4000, 9000];
const MODULE_POLL_INTERVAL_MS = 400;
const MODEL_LIST_HASH_LENGTH = 8;
const WARNING_ATTEMPT_LIMIT = 3;
const WARNING_ATTEMPT_INTERVAL = 10;

export class StageError extends Error {
  readonly stage: string;

  constructor(stage: string) {
    super(`stage:${stage}`);
    this.name = "StageError";
    this.stage = stage;
  }
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return String(message || error).slice(0, 160);
}

export interface FoundDownloadFunction {
  holder: unknown;
  name: DownloadFunctionName;
  fn: DownloadFunction;
}

export function findDownloadFunction(holder: unknown): FoundDownloadFunction | undefined {
  if (holder === null || (typeof holder !== "object" && typeof holder !== "function")) return undefined;
  const candidate = holder as DownloadFunctionHolder;
  for (const name of DOWNLOAD_FUNCTION_NAMES) {
    const fn = candidate[name];
    if (typeof fn === "function") return { holder, name, fn };
  }
  return undefined;
}

export interface WhatsAppModules {
  ensure(timeoutMs: number): Promise<boolean>;
  getCollection(): ModelCollection | undefined;
  getCollectionLabel(): string;
  getCollectionByName(name: string): ModelCollection | undefined;
  getMessageAsync(msgId: string): Promise<WhatsAppMessage | undefined>;
  getDownloadManager(): DownloadManagerModule | undefined;
  getBlobCache(): BlobCache | undefined;
}

export function claimPageFlag(): boolean {
  const pageWindow = window as WhatsAppPageWindow;
  if (pageWindow.__waTranscriberPage) return false;
  pageWindow.__waTranscriberPage = true;
  return true;
}

function requireModule(name: string): unknown {
  const pageWindow = window as WhatsAppPageWindow;
  if (typeof pageWindow.require !== "function") return undefined;
  try {
    return pageWindow.require(name) || undefined;
  } catch {
    return undefined;
  }
}

function isMessageCollection(value: unknown): value is ModelCollection {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof readProperty(value, "get") === "function" ||
    typeof readProperty(value, "getMessagesById") === "function" ||
    typeof readProperty(value, "getModelsArray") === "function"
  );
}

function isCollectionWithGet(value: unknown): value is ModelCollection {
  if (typeof value !== "object" || value === null) return false;
  return typeof readProperty(value, "get") === "function";
}

function asMessage(value: unknown): WhatsAppMessage | undefined {
  return isMessageModel(value) ? value : undefined;
}

function resolveMessageCollection(): { label: string; collection: ModelCollection } | undefined {
  for (const candidate of MESSAGE_COLLECTION_CANDIDATES) {
    const moduleValue = requireModule(candidate.moduleId);
    if (!moduleValue) continue;
    const moduleRecord = moduleValue as MessageModule;
    const members: readonly unknown[] = [moduleRecord.Msg, moduleRecord.MsgCollection];
    for (const member of members) {
      if (isMessageCollection(member)) return { label: candidate.label, collection: member };
    }
    if (isMessageCollection(moduleValue)) return { label: candidate.label, collection: moduleValue };
  }
  return undefined;
}

function resolveDownloadManager(value: unknown): DownloadManagerModule | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value;
}

function resolveBlobCache(value: unknown): BlobCache | undefined {
  const member = readProperty(value, "InMemoryMediaBlobCache");
  if (typeof member !== "object" || member === null) return undefined;
  return member;
}

function modelIdOf(value: unknown): string {
  const id = readProperty(value, "id");
  const serialized = readString(id, "_serialized");
  if (serialized) return serialized;
  const getter = readProperty(id, "toString");
  if (typeof getter !== "function") return "";
  const toText = getter as () => unknown;
  try {
    const text = toText.call(id);
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

export function createWhatsAppModules(log: PageLog): WhatsAppModules {
  let collection: ModelCollection | null = null;
  let collectionLabel = "";
  let downloadModule: DownloadManagerModule | undefined;
  let blobCache: BlobCache | undefined;
  let attempts = 0;

  function shouldReportAttempt(): boolean {
    return attempts <= WARNING_ATTEMPT_LIMIT || attempts % WARNING_ATTEMPT_INTERVAL === 0;
  }

  function load(): boolean {
    attempts += 1;
    const pageWindow = window as WhatsAppPageWindow;
    if (typeof pageWindow.require !== "function") {
      if (shouldReportAttempt()) {
        const missing = `window.require ainda indisponível (tentativa ${String(attempts)}, tipo: ${typeof pageWindow.require})`;
        log("warn", "modulos", missing);
      }
      return false;
    }
    if (!collection) {
      const resolved = resolveMessageCollection();
      if (resolved) {
        collection = resolved.collection;
        collectionLabel = resolved.label;
        log("info", "modulos", `Coleção de mensagens carregada via ${resolved.label}`);
      } else if (shouldReportAttempt()) {
        log("warn", "modulos", "Coleção de mensagens não encontrada nesta tentativa");
      }
    }
    if (!downloadModule) {
      const resolvedModule = resolveDownloadManager(requireModule(DOWNLOAD_MANAGER_MODULE_ID));
      if (resolvedModule) {
        downloadModule = resolvedModule;
        log("info", "modulos", "WAWebDownloadManager carregado");
      }
    }
    if (!blobCache) {
      const resolvedCache = resolveBlobCache(requireModule(BLOB_CACHE_MODULE_ID));
      if (resolvedCache) {
        blobCache = resolvedCache;
        log("info", "modulos", "InMemoryMediaBlobCache carregado");
      }
    }
    return collection !== null;
  }

  function getMessage(msgId: string): WhatsAppMessage | undefined {
    const target = collection;
    if (!target) return undefined;
    const candidates = [msgId];
    const parts = msgId.split("_");
    if (parts.length > 3) candidates.push(parts.slice(0, 3).join("_"));
    for (const id of candidates) {
      try {
        const found = target.get?.(id);
        if (found) {
          log("info", "mensagem", `Encontrada via get(): ${id}`);
          return asMessage(found);
        }
      } catch (error) {
        log("warn", "mensagem", `get() falhou: ${errorText(error)}`);
      }
    }
    return undefined;
  }

  function sweepModels(target: ModelCollection, msgId: string): WhatsAppMessage | undefined {
    const getModelsArray = readProperty(target, "getModelsArray");
    if (typeof getModelsArray !== "function") return undefined;
    const readModels = getModelsArray as () => unknown;
    const hash = msgId.split("_").pop() ?? "";
    try {
      const models = readModels.call(target);
      const list: unknown[] = Array.isArray(models) ? models : [];
      for (const model of list) {
        const modelId = modelIdOf(model);
        const matchedHash = modelId !== "" && modelId.includes(hash) && hash.length >= MODEL_LIST_HASH_LENGTH;
        if (modelId === msgId || matchedHash) {
          log("info", "mensagem", `Encontrada varrendo getModelsArray() (${String(list.length)} modelos)`);
          return asMessage(model);
        }
      }
      log("warn", "mensagem", `Não encontrada em getModelsArray() (${String(list.length)} modelos)`);
    } catch (error) {
      log("warn", "mensagem", `getModelsArray() falhou: ${errorText(error)}`);
    }
    return undefined;
  }

  function sweepModelMap(target: ModelCollection, msgId: string): WhatsAppMessage | undefined {
    const models = target._models;
    if (!models || typeof models.forEach !== "function") return undefined;
    const hash = msgId.split("_").pop() ?? "";
    let found: WhatsAppMessage | undefined;
    try {
      models.forEach((value, key) => {
        if (found) return;
        if (key === msgId || String(key).includes(hash)) found = asMessage(value);
      });
    } catch {
      return undefined;
    }
    if (found) log("info", "mensagem", "Encontrada em _models");
    return found;
  }

  async function getMessageAsync(msgId: string): Promise<WhatsAppMessage | undefined> {
    const target = collection;
    const direct = getMessage(msgId);
    if (direct) return direct;
    if (target && typeof target.getMessagesById === "function") {
      try {
        const result = await target.getMessagesById([msgId]);
        const messages = readProperty(result, "messages");
        if (Array.isArray(messages) && messages.length > 0) {
          const first = asMessage(messages[0]);
          if (first) {
            log("info", "mensagem", "Encontrada via getMessagesById()");
            return first;
          }
        }
      } catch (error) {
        log("warn", "mensagem", `getMessagesById() falhou: ${errorText(error)}`);
      }
    }
    if (target) {
      const swept = sweepModels(target, msgId);
      if (swept) return swept;
      const mapped = sweepModelMap(target, msgId);
      if (mapped) return mapped;
    }
    return undefined;
  }

  async function ensure(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (load()) return true;
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, MODULE_POLL_INTERVAL_MS);
      });
    }
    return load();
  }

  function getCollectionByName(name: string): ModelCollection | undefined {
    const direct = readProperty(requireModule(COLLECTIONS_MODULE_ID), name);
    if (isCollectionWithGet(direct)) return direct;
    const alternative = readProperty(requireModule(`WAWeb${name}Collection`), `${name}Collection`);
    return isCollectionWithGet(alternative) ? alternative : undefined;
  }

  for (const delay of BOOT_RETRY_DELAYS_MS) {
    window.setTimeout(() => {
      if (!collection) load();
    }, delay);
  }

  return {
    ensure,
    getCollection: (): ModelCollection | undefined => collection ?? undefined,
    getCollectionLabel: (): string => collectionLabel,
    getCollectionByName,
    getMessageAsync,
    getDownloadManager: (): DownloadManagerModule | undefined => downloadModule,
    getBlobCache: (): BlobCache | undefined => blobCache,
  };
}
