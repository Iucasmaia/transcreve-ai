const TARGET_SAMPLE_RATE = 16000;

let decoderContext: OfflineAudioContext | null = null;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getDecoderContext(): OfflineAudioContext {
  decoderContext ??= new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE);
  return decoderContext;
}

function downmix(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) {
    return buffer.getChannelData(0);
  }
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] = (mono[index] ?? 0) + (data[index] ?? 0) / channels;
    }
  }
  return mono;
}

export async function decodeToMono16k(
  audioBase64: string,
  mimeType: string,
): Promise<Float32Array> {
  const bytes = base64ToBytes(audioBase64);
  const blob = new Blob([bytes.buffer], { type: mimeType || "audio/ogg" });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await getDecoderContext().decodeAudioData(arrayBuffer);
  return downmix(audioBuffer);
}
