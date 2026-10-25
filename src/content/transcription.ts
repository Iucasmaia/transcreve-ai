import { ext } from "@/shared/browser";
import { t } from "@/shared/i18n";
import { log } from "@/shared/logger";
import { TRANSCRIBE_AUDIO, type TranscribeAudioRequest } from "@/shared/messages";
import type { MessageEntry } from "./dom-observer";
import type { ContentCache } from "./cache.store";
import { isCapturedAudio, type PageBridge } from "./page-bridge";
import { collectPlayElements, extractMsgId, findBalloon } from "./messages/find";
import { refreshButtonState } from "./messages/button";
import { ensureResultBox, setBoxState } from "./messages/result-box";
import { syncMeta } from "./messages/layout/timestamp";

export interface TranscribeOutcome {
  ok: boolean;
  text: string;
  provider: string;
  error: string;
}

export interface TranscribeFlow {
  transcribe(entry: MessageEntry): Promise<void>;
}

export interface TranscribeDeps {
  bridge: PageBridge;
  cache: ContentCache;
}

const STAGE_PREFIX = "stage:";
const UNKNOWN_STAGE = "desconhecido";
const DOWNLOAD_TIMEOUT_MS = 90000;
const ALIVE_TIMEOUT_MS = 4000;
const DEFAULT_MIME_TYPE = "audio/ogg";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTranscribeResponse(value: unknown): TranscribeOutcome {
  if (!isRecord(value)) {
    return { ok: false, text: "", provider: "", error: t("errGeneric") };
  }
  const provider = typeof value.provider === "string" ? value.provider : "";
  if (value.ok === true) {
    return {
      ok: true,
      text: typeof value.text === "string" ? value.text : "",
      provider,
      error: "",
    };
  }
  const error = typeof value.error === "string" && value.error ? value.error : t("errGeneric");
  return { ok: false, text: "", provider, error };
}

function isConnectionError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection|message port closed/i.test(
    text,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendToBackground(message: TranscribeAudioRequest): Promise<unknown> {
  try {
    return await ext.runtime.sendMessage(message);
  } catch (error) {
    if (!isConnectionError(error)) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    await wait(400);
    try {
      return await ext.runtime.sendMessage(message);
    } catch {
      return { ok: false, error: t("errReload") };
    }
  }
}

export async function requestTranscription(
  audioBase64: string,
  mimeType: string,
): Promise<TranscribeOutcome> {
  const message: TranscribeAudioRequest = { type: TRANSCRIBE_AUDIO, audioBase64, mimeType };
  const response = await sendToBackground(message);
  return readTranscribeResponse(response);
}

function friendlyCaptureError(stage: string): string {
  if (stage === "timeout" || stage === "timeout-resposta") return t("errTimeout");
  if (stage === "pagina-nao-pronta") return t("errReload");
  return t("errCapture");
}

function stageFromError(error: string): string {
  return error.indexOf(STAGE_PREFIX) === 0 ? error.slice(STAGE_PREFIX.length) : UNKNOWN_STAGE;
}

function providerTag(outcome: TranscribeOutcome): string {
  return outcome.provider || "provedor";
}

export function createTranscribeFlow(deps: TranscribeDeps): TranscribeFlow {
  async function transcribe(entry: MessageEntry): Promise<void> {
    if (entry.busy) return;
    entry.busy = true;

    const container = entry.container;
    let playEl = entry.playEl.isConnected ? entry.playEl : null;
    if (!playEl) {
      playEl =
        collectPlayElements().filter((element) => container.contains(element))[0] ?? entry.playEl;
    }
    const msgId = extractMsgId(playEl) ?? entry.msgId;
    entry.balloon = findBalloon(playEl, container) ?? entry.balloon;

    log.info("clique", "Transcrever clicado", msgId);
    const box = ensureResultBox(entry);
    syncMeta(entry);
    entry.button.classList.add("wa-tr-loading");
    entry.button.disabled = true;
    setBoxState(box, "loading");

    try {
      if (!msgId) {
        log.error("clique", "Mensagem sem data-id identificável");
        setBoxState(box, "error", friendlyCaptureError("sem-id"), "sem-id");
        return;
      }
      entry.msgId = msgId;

      const alive = await deps.bridge.ensurePageAlive(ALIVE_TIMEOUT_MS);
      if (!alive) {
        log.error("página", "Script de página não respondeu ao PING");
        setBoxState(box, "error", friendlyCaptureError("pagina-nao-pronta"), "pagina-nao-pronta");
        return;
      }

      const captured = await deps.bridge.pageRequest(
        { type: "DOWNLOAD_AUDIO", msgId },
        DOWNLOAD_TIMEOUT_MS,
      );
      if (!captured.ok) {
        const stage = stageFromError(captured.error);
        log.error("download", "Captura falhou", stage);
        setBoxState(box, "error", friendlyCaptureError(stage), stage);
        return;
      }
      if (!isCapturedAudio(captured.payload)) {
        log.error("download", "Captura falhou", UNKNOWN_STAGE);
        setBoxState(box, "error", friendlyCaptureError(UNKNOWN_STAGE), UNKNOWN_STAGE);
        return;
      }
      const audio = captured.payload;
      log.info("download", "Áudio capturado", `${audio.size} bytes, ${audio.mimeType}`);
      setBoxState(box, "loading");

      const outcome = await requestTranscription(audio.base64, audio.mimeType || DEFAULT_MIME_TYPE);
      if (!outcome.ok) {
        log.error(providerTag(outcome), outcome.error);
        setBoxState(box, "error", outcome.error);
        return;
      }
      const text = outcome.text || t("noSpeech");
      log.info(providerTag(outcome), "Transcrição pronta", `${text.length} caracteres`);
      setBoxState(box, "done", text);
      deps.cache.store(msgId, text, "", "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error("clique", "Exceção no fluxo", message.slice(0, 40));
      setBoxState(box, "error", t("errGeneric"), message.slice(0, 40));
    } finally {
      entry.button.classList.remove("wa-tr-loading");
      entry.button.disabled = false;
      entry.busy = false;
      refreshButtonState(entry, deps.cache.has(entry.msgId));
      syncMeta(entry);
    }
  }

  return { transcribe };
}
