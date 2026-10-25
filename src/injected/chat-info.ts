import type { ChatInfo } from "@/shared/types";
import { StageError } from "./whatsapp/modules";
import type { WhatsAppModules } from "./whatsapp/modules";
import { isChatModel, isContactModel, isGroupMetadataModel, readProperty, readString } from "./whatsapp/types";
import type { ChatModel, ModelCollection, WhatsAppMessage } from "./whatsapp/types";

const CHAT_INFO_MODULE_TIMEOUT_MS = 8000;
const GROUP_CHAT_SUFFIX = "@g.us";
const GENERIC_OBJECT_TEXT = "[object Object]";

export function widToString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const serialized = readString(value, "_serialized");
  if (serialized) return serialized;
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  return objectText(value);
}

function objectText(value: unknown): string {
  const toString = readProperty(value, "toString");
  if (typeof toString !== "function") return "";
  const toText = toString as () => unknown;
  try {
    const text = toText.call(value);
    return typeof text === "string" && text !== "" && text !== GENERIC_OBJECT_TEXT ? text : "";
  } catch {
    return "";
  }
}

function firstString(values: readonly unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function chatNameOf(model: ChatModel): string {
  const contact = model.contact;
  return firstString([model.formattedTitle, model.name, contact?.name, contact?.pushname]);
}

function modelById(collection: ModelCollection | undefined, id: string): unknown {
  if (!collection) return undefined;
  try {
    return collection.get?.(id);
  } catch {
    return undefined;
  }
}

export function chatInfoFor(message: WhatsAppMessage, modules: WhatsAppModules): ChatInfo {
  const info: ChatInfo = { chatId: "", chatName: "" };
  const id = message.id;
  if (id) {
    info.chatId = widToString(id.remote ?? id._remote);
    if (!info.chatId) info.chatId = widToString(id);
  }

  const chat = message.chat;
  if (isChatModel(chat)) info.chatName = chatNameOf(chat);

  if (!info.chatName && info.chatId) {
    const model = modelById(modules.getCollectionByName("Chat"), info.chatId);
    if (isChatModel(model)) info.chatName = chatNameOf(model);
  }

  if (!info.chatName && info.chatId.includes(GROUP_CHAT_SUFFIX)) {
    const group = modelById(modules.getCollectionByName("GroupMetadata"), info.chatId);
    if (isGroupMetadataModel(group)) info.chatName = firstString([group.subject, group.name]);
  }

  if (!info.chatName && info.chatId) {
    const contact = modelById(modules.getCollectionByName("Contact"), info.chatId);
    if (isContactModel(contact)) {
      info.chatName = firstString([contact.name, contact.verifiedName, contact.pushname, contact.shortName]);
    }
  }

  if (!info.chatName) info.chatName = firstString([readProperty(message, "notifyName")]);

  return info;
}

export async function resolveChatInfo(modules: WhatsAppModules, msgId: string): Promise<ChatInfo> {
  const ready = await modules.ensure(CHAT_INFO_MODULE_TIMEOUT_MS);
  if (!ready) throw new StageError("require-indisponivel");
  const message = await modules.getMessageAsync(msgId);
  if (!message) throw new StageError("mensagem-nao-encontrada");
  return chatInfoFor(message, modules);
}
