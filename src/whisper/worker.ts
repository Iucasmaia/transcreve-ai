import { progressPercent } from "@/shared/model-progress.util";
import { preloadModel, transcribePcm } from "./engine";
import type { ProgressInfo } from "./types";
import type { WhisperWorkerRequest, WhisperWorkerResponse } from "./worker.protocol";

interface WorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WhisperWorkerRequest>) => void,
  ): void;
  postMessage(message: WhisperWorkerResponse): void;
}

const scope = self as unknown as WorkerScope;

function reporter(model: string): (info: ProgressInfo) => void {
  return (info: ProgressInfo): void => {
    if (info.status !== "progress" && info.status !== "done") {
      return;
    }
    scope.postMessage({
      kind: "progress",
      model,
      file: info.file ?? "",
      percent: progressPercent(info.loaded ?? 0, info.total ?? 0),
    });
  };
}

async function handle(request: WhisperWorkerRequest): Promise<void> {
  try {
    if (request.kind === "preload") {
      await preloadModel(request.model, reporter(request.model));
      scope.postMessage({ kind: "done", id: request.id, ok: true });
      return;
    }
    const result = await transcribePcm(request.pcm, {
      model: request.model,
      language: request.language,
      onProgress: reporter(request.model),
    });
    scope.postMessage({
      kind: "done",
      id: request.id,
      ok: true,
      text: result.text,
      language: result.language,
    });
  } catch (error) {
    scope.postMessage({
      kind: "done",
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

scope.addEventListener("message", (event) => {
  void handle(event.data);
});
