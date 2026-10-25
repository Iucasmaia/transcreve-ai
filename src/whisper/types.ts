export interface WasmBackendOptions {
  numThreads: number;
  proxy: boolean;
  wasmPaths: WasmPaths | string;
}

export interface WasmPaths {
  mjs: string;
  wasm: string;
}

export interface OnnxBackend {
  wasm: WasmBackendOptions;
}

export interface TransformersEnv {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  useWasmCache: boolean;
  backends: { onnx: OnnxBackend };
}

export interface ProgressInfo {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface GenerationConfig {
  is_multilingual?: boolean;
  decoder_start_token_id?: number;
}

export interface GeneratedTokens {
  tolist(): number[][];
}

export interface WhisperModel {
  generation_config?: GenerationConfig;
  config?: GenerationConfig;
  generate(options: {
    input_features: unknown;
    decoder_input_ids: number[][];
    max_new_tokens: number;
  }): Promise<GeneratedTokens>;
}

export interface ProcessorOutput {
  input_features: unknown;
}

export interface TranscriptionPipeline {
  model: WhisperModel;
  tokenizer: { decode(tokens: number[]): string | string[] };
  processor(input: Float32Array): Promise<ProcessorOutput>;
  (audio: Float32Array, options: Record<string, unknown>): Promise<unknown>;
}

export interface PipelineOptions {
  dtype: string;
  device?: string;
  progress_callback?: (progress: ProgressInfo) => void;
}

export interface TransformersModule {
  env: TransformersEnv;
  pipeline(task: string, model: string, options: PipelineOptions): Promise<TranscriptionPipeline>;
}

export function isTransformersModule(value: unknown): value is TransformersModule {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { env?: unknown; pipeline?: unknown };
  if (typeof candidate.pipeline !== "function") return false;
  if (typeof candidate.env !== "object" || candidate.env === null) return false;
  const env = candidate.env as { backends?: unknown };
  return typeof env.backends === "object" && env.backends !== null;
}
