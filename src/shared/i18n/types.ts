import type { en } from "./locales/en";

export type LocaleMessages = typeof en;
export type MessageKey = keyof LocaleMessages;
