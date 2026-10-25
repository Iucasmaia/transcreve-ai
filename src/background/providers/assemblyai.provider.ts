import { t } from "@/shared/i18n";
import { base64ToBytes } from "@/shared/audio.util";
import { fetchJson, numberField, stringField } from "./http.util";
import { ASSEMBLY_BASE_URL, POLL_INTERVAL_MS, POLL_TIMEOUT_MS, type ProviderContext, type ProviderText } from "./types";

async function assemblyFetch(apiKey: string, path: string, options: RequestInit): Promise<unknown> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", apiKey);
  return fetchJson(
    ASSEMBLY_BASE_URL + path,
    { ...options, headers },
    "AssemblyAI",
  );
}

function pollWait(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, POLL_INTERVAL_MS);
  });
}

interface AssemblyTranscript {
  id: string;
  status: string;
  text: string;
  language_code: string | null;
  language_confidence: number | null;
  error: string;
}

function toTranscript(value: unknown): AssemblyTranscript {
  return {
    id: stringField(value, "id"),
    status: stringField(value, "status"),
    text: stringField(value, "text"),
    language_code: stringField(value, "language_code") || null,
    language_confidence: numberField(value, "language_confidence"),
    error: stringField(value, "error"),
  };
}

export async function runAssemblyAI(context: ProviderContext): Promise<ProviderText> {
  const { apiKey, audioBase64, mimeType, settings } = context;
  const upload = await assemblyFetch(apiKey, "/upload", {
    method: "POST",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: base64ToBytes(audioBase64),
  });
  const uploadUrl = stringField(upload, "upload_url");
  if (!uploadUrl) {
    throw new Error(t("bgNoUploadUrl"));
  }

  const body: Record<string, unknown> = {
    audio_url: uploadUrl,
    punctuate: true,
    format_text: true,
  };
  if (settings.languageMode === "manual") {
    body.language_code = settings.languageCode;
  } else {
    body.language_detection = true;
  }

  const created = await assemblyFetch(apiKey, "/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const transcriptId = stringField(created, "id");
  if (!transcriptId) {
    throw new Error(t("bgNoTranscriptId"));
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await pollWait();
    const result = toTranscript(
      await assemblyFetch(apiKey, `/transcript/${transcriptId}`, { method: "GET" }),
    );
    if (result.status === "completed") {
      return {
        text: result.text.trim(),
        languageCode: result.language_code,
        confidence: result.language_confidence,
      };
    }
    if (result.status === "error") {
      throw new Error(result.error || t("errGeneric"));
    }
  }
  throw new Error(t("bgPollTimeout"));
}
