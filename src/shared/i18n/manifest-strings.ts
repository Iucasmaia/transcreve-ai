import type { LocaleId } from "@/shared/types";

export interface ManifestStrings {
  extName: string;
  extDescription: string;
  actionTitle: string;
}

export const MANIFEST_STRINGS: Record<LocaleId, ManifestStrings> = {
  en: {
    extName: "Transcreve.ai",
    extDescription:
      "Transcribe WhatsApp Web voice messages in your browser. Local Whisper, AssemblyAI, OpenAI or Gemini.",
    actionTitle: "Transcreve.ai — Settings",
  },
  "pt-BR": {
    extName: "Transcreve.ai",
    extDescription:
      "Transcreva mensagens de voz do WhatsApp Web no navegador. Whisper local, AssemblyAI, OpenAI ou Gemini.",
    actionTitle: "Transcreve.ai — Configurações",
  },
  "pt-PT": {
    extName: "Transcreve.ai",
    extDescription:
      "Transcreve mensagens de voz do WhatsApp Web no navegador. Whisper local, AssemblyAI, OpenAI ou Gemini.",
    actionTitle: "Transcreve.ai — Definições",
  },
  es: {
    extName: "Transcreve.ai",
    extDescription:
      "Transcribe los mensajes de voz de WhatsApp Web en tu navegador. Whisper local, AssemblyAI, OpenAI o Gemini.",
    actionTitle: "Transcreve.ai — Ajustes",
  },
  fr: {
    extName: "Transcreve.ai",
    extDescription:
      "Transcrivez les messages vocaux de WhatsApp Web dans votre navigateur. Whisper, AssemblyAI, OpenAI ou Gemini.",
    actionTitle: "Transcreve.ai — Paramètres",
  },
  it: {
    extName: "Transcreve.ai",
    extDescription:
      "Trascrivi i messaggi vocali di WhatsApp Web nel browser. Whisper locale, AssemblyAI, OpenAI o Gemini.",
    actionTitle: "Transcreve.ai — Impostazioni",
  },
  ru: {
    extName: "Transcreve.ai",
    extDescription:
      "Транскрипция голосовых сообщений WhatsApp Web. Whisper, AssemblyAI, OpenAI или Gemini.",
    actionTitle: "Transcreve.ai — Настройки",
  },
};
