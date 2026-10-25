import { fetchJson, isRecord } from "./http.util";
import { GEMINI_BASE_URL, type ProviderContext, type ProviderText } from "./types";

const LANGUAGE_NAMES: Record<string, string> = {
  pt: "português",
  en: "inglês",
  es: "espanhol",
  fr: "francês",
  de: "alemão",
  it: "italiano",
  nl: "holandês",
  ja: "japonês",
  zh: "chinês",
  ru: "russo",
  ko: "coreano",
  hi: "hindi",
  pl: "polonês",
  tr: "turco",
  uk: "ucraniano",
  ar: "árabe",
};

const BASE_INSTRUCTION =
  "Transcreva o áudio a seguir fielmente, em texto corrido, no idioma original da fala. " +
  "Não resuma, não comente e não use markdown; responda apenas com a transcrição.";

function instructionFor(settings: ProviderContext["settings"]): string {
  if (settings.languageMode !== "manual") {
    return BASE_INSTRUCTION;
  }
  const name = LANGUAGE_NAMES[settings.languageCode] ?? settings.languageCode;
  return `${BASE_INSTRUCTION} O idioma falado é ${name}.`;
}

function extractText(data: unknown): string {
  if (!isRecord(data)) return "";
  const candidates: unknown = data.candidates;
  if (!Array.isArray(candidates)) return "";
  const first: unknown = candidates[0];
  if (!isRecord(first)) return "";
  const content: unknown = first.content;
  if (!isRecord(content)) return "";
  const parts: unknown = content.parts;
  if (!Array.isArray(parts)) return "";
  let text = "";
  for (const part of parts) {
    if (isRecord(part) && typeof part.text === "string") {
      text += part.text;
    }
  }
  return text.trim();
}

export async function runGemini(context: ProviderContext): Promise<ProviderText> {
  const { apiKey, audioBase64, mimeType, settings } = context;
  const model = settings.models.gemini || "gemini-2.5-flash";

  const data = await fetchJson(
    `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: instructionFor(settings) },
              { inline_data: { mime_type: mimeType || "audio/ogg", data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
    "Google Gemini",
  );

  return { text: extractText(data), languageCode: null, confidence: null };
}
