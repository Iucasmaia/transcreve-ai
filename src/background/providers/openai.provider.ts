import { audioBlob, extensionForMime } from "@/shared/audio.util";
import { fetchJson, stringField } from "./http.util";
import { OPENAI_BASE_URL, type ProviderContext, type ProviderText } from "./types";

export async function runOpenAI(context: ProviderContext): Promise<ProviderText> {
  const { apiKey, audioBase64, mimeType, settings } = context;
  const type = mimeType || "audio/ogg";
  const model = settings.models.openai || "whisper-1";

  const form = new FormData();
  form.append("file", audioBlob(audioBase64, type), `audio.${extensionForMime(type)}`);
  form.append("model", model);
  if (settings.languageMode === "manual" && settings.languageCode) {
    form.append("language", settings.languageCode);
  }

  const data = await fetchJson(
    `${OPENAI_BASE_URL}/audio/transcriptions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
    "OpenAI",
  );

  const text = stringField(data, "text") || stringField(data, "transcription");
  return { text: text.trim(), languageCode: null, confidence: null };
}
