import { log } from "@/shared/logger";
import type { TranscriptionPipeline } from "./types";

const LANGUAGE_WINDOW_SAMPLES = 16000 * 30;
const LANGUAGE_CODE = /^[a-z]{2,3}$/;

export function isMultilingual(pipeline: TranscriptionPipeline): boolean {
  const config = pipeline.model.generation_config ?? pipeline.model.config;
  return config?.is_multilingual === true;
}

function decodeToken(pipeline: TranscriptionPipeline, token: number): string {
  const decoded = pipeline.tokenizer.decode([token]);
  const text = Array.isArray(decoded) ? decoded.join("") : decoded;
  return text.replace(/[<|>]/g, "").trim().toLowerCase();
}

export async function detectLanguage(
  pipeline: TranscriptionPipeline,
  pcm: Float32Array,
): Promise<string> {
  const config = pipeline.model.generation_config ?? pipeline.model.config;
  const startToken = config?.decoder_start_token_id;
  if (typeof startToken !== "number") {
    return "";
  }
  try {
    const window = pcm.length > LANGUAGE_WINDOW_SAMPLES ? pcm.subarray(0, LANGUAGE_WINDOW_SAMPLES) : pcm;
    const features = await pipeline.processor(window);
    const generated = await pipeline.model.generate({
      input_features: features.input_features,
      decoder_input_ids: [[startToken]],
      max_new_tokens: 1,
    });
    const row = generated.tolist()[0] ?? [];
    const token = Number(row[row.length - 1]);
    if (!Number.isFinite(token) || token === 0) {
      return "";
    }
    const code = decodeToken(pipeline, token);
    return LANGUAGE_CODE.test(code) ? code : "";
  } catch (error) {
    log.warn("whisper", "language detection failed", String(error));
    return "";
  }
}
