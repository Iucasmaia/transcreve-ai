import { extensionUrl } from "@/shared/browser";
import { writeModelProgress } from "@/shared/model-progress";
import type { WhisperWorkerRequest, WhisperWorkerResponse } from "./worker.protocol";

export interface WhisperTranscript {
  text: string;
  language: string | null;
}

export interface WhisperHost {
  preload(model: string): Promise<void>;
  transcribe(pcm: Float32Array, model: string, language: string): Promise<WhisperTranscript>;
}

interface Pending {
  model: string;
  settle(response: Extract<WhisperWorkerResponse, { kind: "done" }>): void;
}

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;
let lastProgressAt = 0;

function persistProgress(
  model: string,
  file: string,
  percent: number,
  state: "downloading" | "ready" | "error",
  error = "",
): void {
  const now = Date.now();
  if (state === "downloading" && now - lastProgressAt < 400) {
    return;
  }
  lastProgressAt = now;
  void writeModelProgress({
    model,
    state,
    file,
    percent,
    error,
    updatedAt: now,
  }).catch(() => undefined);
}

function ensureWorker(): Worker {
  if (worker) {
    return worker;
  }
  const created = new Worker(extensionUrl("whisper-worker.js"));
  created.addEventListener("message", (event: MessageEvent<WhisperWorkerResponse>) => {
    const response = event.data;
    if (response.kind === "progress") {
      persistProgress(response.model, response.file, response.percent, "downloading");
      return;
    }
    const entry = pending.get(response.id);
    if (!entry) {
      return;
    }
    pending.delete(response.id);
    entry.settle(response);
  });
  created.addEventListener("error", (event: ErrorEvent) => {
    const message = event.message || "worker failed";
    for (const entry of pending.values()) {
      entry.settle({ kind: "done", id: 0, ok: false, error: message });
    }
    pending.clear();
    worker = null;
  });
  worker = created;
  return created;
}

function send(request: WhisperWorkerRequest): Promise<Extract<WhisperWorkerResponse, { kind: "done" }>> {
  const instance = ensureWorker();
  return new Promise((resolve) => {
    pending.set(request.id, {
      model: request.model,
      settle: (response) => {
        if (response.ok) {
          persistProgress(request.model, "", 100, "ready");
        } else {
          persistProgress(request.model, "", 0, "error", response.error);
        }
        resolve(response);
      },
    });
    instance.postMessage(request);
  });
}

function nextRequestId(): number {
  const id = nextId;
  nextId += 1;
  return id;
}

let host: WhisperHost | null = null;

export function getWhisperHost(): WhisperHost {
  if (host) {
    return host;
  }
  host = {
    async preload(model: string): Promise<void> {
      const response = await send({ id: nextRequestId(), kind: "preload", model });
      if (!response.ok) {
        throw new Error(response.error);
      }
    },
    async transcribe(
      pcm: Float32Array,
      model: string,
      language: string,
    ): Promise<WhisperTranscript> {
      const response = await send({
        id: nextRequestId(),
        kind: "transcribe",
        model,
        language,
        pcm,
      });
      if (!response.ok) {
        throw new Error(response.error);
      }
      return { text: response.text ?? "", language: response.language ?? null };
    },
  };
  return host;
}
