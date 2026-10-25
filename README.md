# Transcreve.ai

Browser extension (Chrome MV3 + Firefox MV3) that adds a green mic button to every
voice message on WhatsApp Web. The transcript appears **inside the message bubble,
right below the player**, with a copy button.

> Transcreve.ai is an independent project with no relationship to WhatsApp or Meta.
> The full notice is in [DISCLAIMER.md](./DISCLAIMER.md).

Four providers, chosen by you:

| Provider | Where it runs | Key | Default model |
|---|---|---|---|
| **Local (Whisper)** | your own browser (transformers.js + ONNX WebAssembly) | none | `onnx-community/whisper-base` |
| **AssemblyAI** | cloud | required | — |
| **OpenAI** | cloud | required | `whisper-1` |
| **Google Gemini** | cloud | required | `gemini-2.5-flash` |

Defaults out of the box: **Local (Whisper)**, audio language on **automatic**, and
automatic transcription for **all conversations** (channels stay off until you enable
them). Defaults apply to fresh installs — a browser that already stored settings keeps
them, so after upgrading a previous build remove the extension and load it again, or
change the values once in the panel.

## Requirements

- Node 20+ and yarn (or npm) to build.
- Chrome 120+ or Firefox 128+ (Firefox 128 is the minimum that accepts the content
  script in the `MAIN` world, which is how the audio is downloaded).

> If your shell has `NODE_ENV=production`, package managers skip devDependencies.
> Run `npm install --include=dev` or clear the variable before `yarn install`.

## Build

```bash
yarn install          # or: npm install --include=dev
yarn build            # typecheck + bundles + manifests + vendor runtime
```

Output:

- `dist/chrome` — load unpacked at `chrome://extensions` (enable Developer mode →
  "Load unpacked").
- `dist/firefox` — load `dist/firefox/manifest.json` at
  `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on". The add-on id is
  `transcreve-ai@lucasmaia.org`; if an older build is still listed, remove it first.

`yarn dev` rebuilds both targets on change.

## Configure

Open the extension (toolbar icon, or Options from the extensions page).

- **Provider** — switching the provider is saved immediately, because it decides
  whether the audio leaves your machine. No need to press **Salvar**.
- **API key** and **model** — stored per provider, so switching does not erase the
  others. Keys live only in `storage.local` (never synced) and are sent only to the
  provider you chose. The Local provider has no key field.
- **Audio language** — **Automatico** lets the provider detect it (AssemblyAI
  `language_detection`, Gemini through the prompt, and for the local Whisper a real
  detection step). **Fixo** sends the language you pick.
- **Auto transcription** — off, only the open conversation, or every conversation,
  with independent filters for contacts, groups and channels (channels start off).
  Only messages that arrive **after** the monitor starts are eligible (60s
  tolerance), so history WhatsApp loads lazily is never transcribed.
- **Theme** — light/dark, saved in `panelTheme`, follows the system by default.
- **Transcription cache** — total, list by conversation, clear one conversation or
  all of it. Clearing takes effect immediately in the open WhatsApp tabs.

### Local Whisper

Runs entirely in your browser: no key, no server, and the audio never leaves the
machine.

- The model is downloaded once from Hugging Face and then cached by the browser
  (~41 MB for `whisper-tiny`, ~77 MB for `whisper-base`). The first transcription is
  therefore much slower than the following ones.
- On Chrome the engine runs in an **offscreen document** (the MV3 service worker has
  no `AudioContext`); on Firefox it runs in the background page.
- The runtime (`transformers.js` + `onnxruntime-web` + the `.wasm`) ships inside the
  extension under `vendor/` — the default `wasmPaths` would point at the jsDelivr CDN,
  which MV3 forbids.
- Slower than the cloud: `whisper-base` is roughly 1x–3x the audio duration on a
  normal laptop, and `whisper-tiny` makes many mistakes in Portuguese. Prefer `base`.

## Usage

1. Open [web.whatsapp.com](https://web.whatsapp.com).
2. Click the green mic button next to a voice message. The audio is downloaded
   silently in the background — nothing is played.
3. Three animated dots while it works, then the "Transcrição" header fades in and the
   text is typed into the bubble.
4. **Clicking again re-transcribes** with the current provider or model, replacing the
   box.
5. Transcripts already cached appear instantly, with no animation.

## Privacy

- Cloud providers: the audio leaves the browser only when you transcribe, and goes
  straight to the provider you chose with your own key.
- Local provider: the audio never leaves the browser.
- No server, no analytics, no audio stored. Transcripts live in the extension's local
  storage (up to 500 entries) and in the open page.
- The only network calls are to the provider endpoints and, for the local provider, to
  Hugging Face for the model weights.

## Costs

Cloud providers bill your own account. The local provider is free — the only cost is
your CPU time and the one-time model download.

## Troubleshooting

- **Button does not appear** — reload the WhatsApp Web tab after installing or
  changing settings. WhatsApp loads conversations on demand; the button shows up as
  soon as a voice message enters the screen.
- **"Não foi possível obter o áudio desta mensagem"** — the box shows a short code
  (`mensagem-nao-encontrada`, `decrypt-sem-dados`, `timeout`, ...). Filter the console
  by `Transcreve.ai` for the full trace.
- **Which provider actually ran?** — the console prefix reports it:
  `[Transcreve.ai] (local) pronta (local)`. It comes from the background, so it is
  never a hardcoded label.
- **Wrong language** — switch to **Fixo** and pick the language.
- **WhatsApp changed its layout** — the selectors are the constants at the top of
  `src/content/messages/find.ts`; `docs/whatsapp-dom.md` documents the contract.

## Disclaimer

Transcreve.ai is an independent project. It is **not** affiliated with, endorsed by or
sponsored by WhatsApp LLC or Meta Platforms, Inc., and it redistributes no WhatsApp
content, code, font or asset. The extension runs inside your own logged-in browser
session, transcribes audio that session already has access to, and keeps the transcripts
in local extension storage on your machine — there is no server. Your use of WhatsApp
Web remains governed by WhatsApp's own Terms of Service, and transcribing other people's
audio may require their consent. The full notice, including the licences of the bundled
runtime, is in [DISCLAIMER.md](./DISCLAIMER.md).

## Project

| Command | What it does |
|---|---|
| `yarn dev` | esbuild watch → `dist/chrome` and `dist/firefox` |
| `yarn build` | typecheck, then bundles, manifests, static and vendor runtime |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn lint` | eslint flat config |
| `yarn test` | vitest + jsdom |
| `yarn vendor` | copy the pinned Whisper runtime into both targets |
| `yarn validate` | comments, file size, boundaries and i18n guardrails |

The code is 100% TypeScript, zero comments, and organized by layer. The hard rules are
in [AGENTS.md](./AGENTS.md); the architecture and every contract (WhatsApp DOM,
WhatsApp internals, providers, local Whisper, storage, i18n) are documented under
[docs/](./docs/README.md).
