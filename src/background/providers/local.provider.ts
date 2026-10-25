import { t } from "@/shared/i18n";
import { isLocalWhisperReply, LOCAL_WHISPER_TRANSCRIBE } from "@/shared/messages";
import { decodeToMono16k } from "@/whisper/decode";
import { getWhisperHost } from "@/whisper/host";
import { supportsOffscreen, transcribeInOffscreen } from "../offscreen";
import type { ProviderContext, ProviderText } from "./types";

function toText(text: string, language: string | null): ProviderText {
  return { text, languageCode: language, confidence: null };
}

export async function runLocal(context: ProviderContext): Promise<ProviderText> {
  const model = context.settings.models.local;
  const language =
    context.settings.languageMode === "manual" ? context.settings.languageCode : "";

  if (supportsOffscreen()) {
    const reply = await transcribeInOffscreen({
      type: LOCAL_WHISPER_TRANSCRIBE,
      audioBase64: context.audioBase64,
      mimeType: context.mimeType,
      model,
      language,
    });
    if (!isLocalWhisperReply(reply)) {
      throw new Error(t("errGeneric"));
    }
    if (!reply.ok) {
      throw new Error(reply.error);
    }
    return toText(reply.text, reply.language);
  }

  const pcm = await decodeToMono16k(context.audioBase64, context.mimeType);
  const result = await getWhisperHost().transcribe(pcm, model, language);
  return toText(result.text, result.language);
}
