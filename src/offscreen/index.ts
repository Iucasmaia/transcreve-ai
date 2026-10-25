import { log } from "@/shared/logger";
import { addMessageListener } from "@/shared/messaging.util";
import {
  isLocalWhisperPreload,
  isLocalWhisperRequest,
  isOffscreenPing,
  type LocalWhisperReply,
} from "@/shared/messages";
import { decodeToMono16k } from "@/whisper/decode";
import { getWhisperHost } from "@/whisper/host";

addMessageListener(async (message) => {
  if (isOffscreenPing(message)) {
    return { ok: true };
  }
  const host = getWhisperHost();
  if (isLocalWhisperPreload(message)) {
    try {
      await host.preload(message.model);
      return { ok: true };
    } catch (error) {
      log.error("offscreen", "preload failed", String(error));
      return { ok: false, error: String(error) };
    }
  }
  if (!isLocalWhisperRequest(message)) {
    return undefined;
  }
  try {
    const pcm = await decodeToMono16k(message.audioBase64, message.mimeType);
    const result = await host.transcribe(pcm, message.model, message.language);
    const response: LocalWhisperReply = {
      ok: true,
      text: result.text,
      language: result.language,
    };
    return response;
  } catch (error) {
    log.error("offscreen", "local whisper failed", String(error));
    const response: LocalWhisperReply = { ok: false, error: String(error) };
    return response;
  }
});
