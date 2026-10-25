export interface WorkerPreloadRequest {
  id: number;
  kind: "preload";
  model: string;
}

export interface WorkerTranscribeRequest {
  id: number;
  kind: "transcribe";
  model: string;
  language: string;
  pcm: Float32Array;
}

export type WhisperWorkerRequest = WorkerPreloadRequest | WorkerTranscribeRequest;

export type WhisperWorkerResponse =
  | { kind: "progress"; model: string; file: string; percent: number }
  | { kind: "done"; id: number; ok: true; text?: string; language?: string | null }
  | { kind: "done"; id: number; ok: false; error: string };
