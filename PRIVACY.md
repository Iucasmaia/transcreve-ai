# Privacy policy

Transcreve.ai is a browser extension for transcribing voice messages on WhatsApp Web.
This page describes exactly what the extension does with data. The legal notice — no
affiliation with WhatsApp or Meta, trademarks, and the third-party licences — is in
[DISCLAIMER.md](./DISCLAIMER.md).

## What the extension does not do

- No server of its own, no backend, no account, no sign-up.
- No analytics, telemetry, crash reporting, advertising or fingerprinting.
- No selling, sharing or transferring data to third parties beyond the provider you
  choose for a transcription.
- No reading of your messages other than the voice note you explicitly transcribe (or
  the new voice notes your own automatic-transcription setting selects).

## Data stored on your device

All of it lives in the browser's extension storage (`storage.local`) and never syncs:

| What | Why | Where |
|---|---|---|
| Provider, model, audio language, automatic-transcription mode and type filters, interface language, panel theme | your settings | `storage.local` |
| API keys you type | authenticate your own account with the chosen provider | `storage.local` |
| Transcripts (up to 500, newest first) | show a transcript again without re-transcribing, and the cache panel that lets you delete them | `storage.local` |
| Local Whisper download progress | render the progress bar in the panel | `storage.local` |
| Downloaded Whisper model weights (only for the Local provider) | run transcription without downloading again | the browser's HTTP cache |

Removing the extension deletes all of it. The panel's **Limpar tudo** deletes the
transcript cache immediately.

## Data that leaves your browser

Only in two situations, and only what is necessary:

1. **Cloud transcription.** When you transcribe with AssemblyAI, OpenAI or Gemini, the
   audio of that single voice message is sent directly to the provider you selected,
   authenticated with **your** API key. Nothing else is sent — no chat name, no contact,
   no message history. Each provider processes that audio under its own terms and
   retention policy.
2. **Local model download.** When you use the Local (Whisper) provider, the extension
   downloads model weights **from** Hugging Face. This is an outbound download only: no
   audio, transcript or identifier is sent.

With the Local provider the audio **never** leaves your machine — decoding and inference
run entirely inside your browser.

## Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | keep your settings, keys, transcripts and progress locally |
| `scripting`, `activeTab` | inject the page script that reads the voice note your own session already has access to |
| `offscreen` (Chrome only) | run the local Whisper engine outside the service worker, which has no `AudioContext` |
| host permissions for `web.whatsapp.com`, the three provider APIs and Hugging Face | reach the site you use, the provider you choose, and the model download |

## Children

The extension is a general-purpose transcription tool. It is not directed at children and
does not knowingly process children's data beyond the messages in the account that
installed it.

## Changes

Any change to this policy ships with the extension version that introduces it.

## Contact

Questions or a data request: open an issue at
[github.com/Iucasmaia](https://github.com/Iucasmaia).
