import type { LocaleId } from "@/shared/types";
import { en } from "./locales/en";
import { ptBR } from "./locales/pt-BR";
import { ptPT } from "./locales/pt-PT";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { ru } from "./locales/ru";
import type { LocaleMessages } from "./types";

export const LOCALE_MESSAGES: Record<LocaleId, LocaleMessages> = {
  en,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  es,
  fr,
  it,
  ru,
};
