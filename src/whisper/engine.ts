import { log } from "@/shared/logger";
import { detectLanguage, isMultilingual } from "./language";
import {
  isTransformersModule,
  type ProgressInfo,
  type TranscriptionPipeline,
  type TransformersEnv,
  type TransformersModule,
  type WasmPaths,
} from "./types";

export const DEFAULT_WHISPER_MODEL = "onnx-community/whisper-base";

const TRANSFORMERS_ENTRY = "vendor/transformers.min.js";
const WASM_ENTRY_MJS = "vendor/ort-wasm-simd-threaded.asyncify.mjs";
const WASM_ENTRY_BIN = "vendor/ort-wasm-simd-threaded.asyncify.wasm";

const CHUNK_LENGTH_SECONDS = 30;
const STRIDE_LENGTH_SECONDS = 5;

let modulePromise: Promise<TransformersModule> | null = null;
const pipelines = new Map<string, Promise<TranscriptionPipeline>>();

function vendorUrl(path: string): string {
  return new URL(path, location.href).href;
}

function useLocalWasm(env: TransformersEnv, paths: WasmPaths): void {
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = paths;
    return;
  }
  let current = env.backends.onnx;
  Object.defineProperty(env.backends, "onnx", {
    configurable: true,
    get(): unknown {
      return current;
    },
    set(value: unknown): void {
      const candidate = value as { wasm?: { wasmPaths?: WasmPaths } } | null;
      if (candidate?.wasm) {
        candidate.wasm.wasmPaths = paths;
      }
      current = value as typeof current;
    },
  });
}

async function loadModule(): Promise<TransformersModule> {
  modulePromise ??= (async () => {
    const imported: unknown = await import(vendorUrl(TRANSFORMERS_ENTRY));
    if (!isTransformersModule(imported)) {
      throw new Error("transformers runtime unavailable");
    }
    imported.env.allowLocalModels = false;
    imported.env.allowRemoteModels = true;
    imported.env.useWasmCache = false;
    useLocalWasm(imported.env, {
      mjs: vendorUrl(WASM_ENTRY_MJS),
      wasm: vendorUrl(WASM_ENTRY_BIN),
    });
    return imported;
  })();
  return modulePromise;
}

function getPipeline(
  model: string,
  onProgress?: (progress: ProgressInfo) => void,
): Promise<TranscriptionPipeline> {
  const existing = pipelines.get(model);
  if (existing) {
    return existing;
  }
  const created = (async () => {
    const runtime = await loadModule();
    const options = {
      dtype: "q8",
      ...(onProgress ? { progress_callback: onProgress } : {}),
    };
    try {
      return await runtime.pipeline("automatic-speech-recognition", model, {
        ...options,
        device: "wasm",
      });
    } catch (error) {
      if (!/Unsupported device/i.test(String(error))) {
        throw error;
      }
      return await runtime.pipeline("automatic-speech-recognition", model, {
        ...options,
        device: "cpu",
      });
    }
  })();
  pipelines.set(model, created);
  return created;
}

export function preloadModel(
  model: string = DEFAULT_WHISPER_MODEL,
  onProgress?: (progress: ProgressInfo) => void,
): Promise<void> {
  return getPipeline(model, onProgress).then(() => undefined);
}

function readText(result: unknown): string {
  if (Array.isArray(result)) {
    return result
      .map((item) => (item as { text?: string } | null)?.text ?? "")
      .join(" ");
  }
  const single = result as { text?: string } | null;
  return single?.text ?? "";
}

export interface TranscribeOptions {
  model?: string;
  language?: string;
  onProgress?: (progress: ProgressInfo) => void;
}

export interface WhisperTranscript {
  text: string;
  language: string | null;
}

export async function transcribePcm(
  pcm: Float32Array,
  options: TranscribeOptions = {},
): Promise<WhisperTranscript> {
  const model = options.model ?? DEFAULT_WHISPER_MODEL;
  const pipeline = await getPipeline(model, options.onProgress);

  const multilingual = isMultilingual(pipeline);
  let language = multilingual ? (options.language ?? "").trim() : "";
  if (multilingual && !language) {
    language = await detectLanguage(pipeline, pcm);
  }

  const callOptions: Record<string, unknown> = {
    chunk_length_s: CHUNK_LENGTH_SECONDS,
    stride_length_s: STRIDE_LENGTH_SECONDS,
  };
  if (multilingual) {
    callOptions.task = "transcribe";
    if (language) {
      callOptions.language = language;
    }
  }

  const result = await pipeline(pcm, callOptions);
  const text = readText(result).trim();
  log.info("whisper", "transcription finished", `${model} ${language || "auto"} ${text.length}`);
  return { text, language: language || null };
}
