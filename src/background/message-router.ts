import { addMessageListener } from "@/shared/messaging.util";
import {
  isPreloadLocalModel,
  isTranscribeAudioRequest,
  type TranscribeAudioResponse,
} from "@/shared/messages";
import { preloadLocalModel } from "./local-model.service";
import { currentProviderId, transcribeAudio } from "./transcription.service";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerMessageRouter(): void {
  addMessageListener(async (message) => {
    if (isPreloadLocalModel(message)) {
      void preloadLocalModel().catch(() => undefined);
      return { ok: true };
    }
    if (!isTranscribeAudioRequest(message)) {
      return undefined;
    }
    try {
      const result = await transcribeAudio(message.audioBase64, message.mimeType);
      const response: TranscribeAudioResponse = { ok: true, ...result };
      return response;
    } catch (error) {
      let provider = "";
      try {
        provider = await currentProviderId();
      } catch {
        provider = "";
      }
      const response: TranscribeAudioResponse = {
        ok: false,
        error: errorMessage(error),
        provider,
      };
      return response;
    }
  });
}
