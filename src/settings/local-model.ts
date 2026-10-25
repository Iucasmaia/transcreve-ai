import { ext } from "@/shared/browser";
import { t } from "@/shared/i18n";
import { PRELOAD_LOCAL_MODEL, type PreloadLocalModelRequest } from "@/shared/messages";
import { MODEL_PROGRESS_KEY, readModelProgress, type ModelProgress } from "@/shared/model-progress";
import type { ProviderId } from "@/shared/types";

export interface LocalModelBlock {
  show(provider: ProviderId): void;
  start(model: string): void;
}

function required<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) {
    throw new Error(selector);
  }
  return found;
}

function percentOf(progress: ModelProgress | null): number {
  if (progress?.state === "ready") return 100;
  if (progress?.state === "downloading") return progress.percent;
  return 0;
}

function describe(progress: ModelProgress | null): string {
  if (!progress || progress.state === "idle") return t("localModelIdle");
  if (progress.state === "ready") return t("localModelReady");
  if (progress.state === "error") return t("localModelError", { error: progress.error });
  return t("localModelDownloading", {
    file: progress.file || "—",
    percent: progress.percent,
  });
}

export function mountLocalModelBlock(): LocalModelBlock {
  const block = required<HTMLElement>("#localModel");
  const bar = required<HTMLElement>("#localModelBar");
  const fill = required<HTMLElement>("#localModelFill");
  const status = required<HTMLElement>("#localModelState");
  let progress: ModelProgress | null = null;

  const paint = (): void => {
    fill.style.width = `${percentOf(progress)}%`;
    bar.dataset["state"] = progress?.state ?? "idle";
    status.textContent = describe(progress);
  };

  const refresh = (): void => {
    void readModelProgress().then((value) => {
      progress = value;
      paint();
    });
  };

  refresh();
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(MODEL_PROGRESS_KEY in changes)) return;
    refresh();
  });

  return {
    show(provider: ProviderId): void {
      block.hidden = provider !== "local";
    },
    start(model: string): void {
      if (!model) return;
      const request: PreloadLocalModelRequest = { type: PRELOAD_LOCAL_MODEL, model };
      void ext.runtime.sendMessage(request).catch(() => undefined);
    },
  };
}
