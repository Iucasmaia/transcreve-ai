import { z } from "zod";
import { ext } from "./browser";

export const MODEL_PROGRESS_KEY = "localModelProgress";

export type ModelProgressState = "idle" | "downloading" | "ready" | "error";

export interface ModelProgress {
  model: string;
  state: ModelProgressState;
  file: string;
  percent: number;
  error: string;
  updatedAt: number;
}

const progressSchema = z
  .object({
    model: z.string().catch(""),
    state: z.enum(["idle", "downloading", "ready", "error"]).catch("idle"),
    file: z.string().catch(""),
    percent: z.number().catch(0),
    error: z.string().catch(""),
    updatedAt: z.number().catch(0),
  })
  .catch({
    model: "",
    state: "idle",
    file: "",
    percent: 0,
    error: "",
    updatedAt: 0,
  });

export async function readModelProgress(): Promise<ModelProgress> {
  const raw = await ext.storage.local.get(MODEL_PROGRESS_KEY);
  return progressSchema.parse(raw[MODEL_PROGRESS_KEY] ?? {});
}

export async function writeModelProgress(progress: ModelProgress): Promise<void> {
  await ext.storage.local.set({ [MODEL_PROGRESS_KEY]: progress });
}
