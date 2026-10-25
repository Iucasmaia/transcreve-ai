const MIME_EXTENSIONS: readonly (readonly [string, string])[] = [
  ["ogg", "ogg"],
  ["mpeg", "mp3"],
  ["mp3", "mp3"],
  ["mp4", "m4a"],
  ["m4a", "m4a"],
  ["webm", "webm"],
  ["wav", "wav"],
  ["flac", "flac"],
  ["aac", "aac"],
];

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  for (const [needle, extension] of MIME_EXTENSIONS) {
    if (normalized.includes(needle)) {
      return extension;
    }
  }
  return "ogg";
}

export function audioBlob(audioBase64: string, mimeType: string): Blob {
  const type = mimeType || "audio/ogg";
  return new Blob([base64ToBytes(audioBase64).buffer], { type });
}
