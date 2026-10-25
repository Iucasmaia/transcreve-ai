# Providers

| id | label | needs key | default model | endpoint |
|---|---|---|---|---|
| `assemblyai` | AssemblyAI | yes | none (no model field) | `https://api.assemblyai.com/v2` |
| `openai` | OpenAI | yes | `whisper-1` | `https://api.openai.com/v1/audio/transcriptions` |
| `gemini` | Google Gemini | yes | `gemini-2.5-flash` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| `local` | Local (Whisper) | no | `onnx-community/whisper-base` | none — runs in the browser |

The registry lives in `src/background/providers/registry.ts`; each provider is a
`*.provider.ts` file exporting a `run(context)` that returns
`{ text, languageCode, confidence }`.

## Requests

- **AssemblyAI**: `POST /upload` with the raw bytes, then `POST /transcript`
  (`audio_url`, `punctuate`, `format_text`) and polling `GET /transcript/{id}` every 3s
  until `completed` or `error`, with a 5 minute deadline. With the audio language set to
  automatic it sends `language_detection: true`, otherwise `language_code`.
- **OpenAI**: `multipart/form-data` with the `file` (extension derived from the MIME
  type) and `model`; `language` only when the language mode is manual. `Content-Type` is
  deliberately not set so the browser writes the multipart boundary.
- **Gemini**: `contents[0].parts` with the instruction text plus `inline_data`
  (`mime_type` and the base64 audio), `generationConfig.temperature: 0`. The instruction
  asks for a faithful transcription, no summary, no markdown, and names the language
  when the mode is manual (using the Portuguese language names map).
- **Local**: no HTTP at all. See [local-whisper.md](./local-whisper.md).

## Language behavior

| Provider | Automatic | Manual |
|---|---|---|
| AssemblyAI | `language_detection: true` | `language_code` |
| OpenAI | omitted (Whisper detects) | `language` form field |
| Gemini | instruction without a language | instruction naming the language |
| Local | one decoder step reads the detected language token | the chosen language is forced |

## Keys and models

Storage is flat and per provider (`src/shared/settings.schema.ts`): `assemblyApiKey`,
`openaiApiKey`, `geminiApiKey`, `openaiModel`, `geminiModel`, `localModel`. Switching
the provider in the panel never erases another provider's key or model, and the provider
select itself is persisted immediately because it decides whether the audio leaves the
machine.

## Errors and diagnostics

`fetchJson` maps a provider error body (string `error`, `error.message` or `message`)
to an `Error`, falling back to a translated `bgHttpError` with the provider label and
the HTTP status. On success the background returns the provider id that actually ran,
and the content script logs it as the diagnostics tag, so the console never reports a
provider name that was not used.
