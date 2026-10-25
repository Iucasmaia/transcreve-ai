# Documentation

This directory is the written mirror of the code. Every statement here must be
verifiable in `src/`; when the two disagree, the executable source wins and the doc is
fixed in the same delivery.

The hard rules for anything written in this repository live in [AGENTS.md](../AGENTS.md).
Read that first; this index only maps the architecture.

## Entrypoints

| Entrypoint | Output | Runs in |
|---|---|---|
| `src/background/index.ts` | `background.js` | service worker (Chrome) / event page (`background.scripts`, Firefox) |
| `src/content/index.ts` | `content.js` | isolated world on `web.whatsapp.com` |
| `src/injected/index.ts` | `injected.js` | `world: MAIN`, self-contained |
| `src/settings/index.ts` | `settings.js` | `popup.html` and `options.html` |
| `src/offscreen/index.ts` | `offscreen.js` | Chrome offscreen document (local Whisper only) |
| `src/whisper/worker.ts` | `whisper-worker.js` | Web Worker that owns the Whisper pipeline and emits download progress |

## Flow

```
content ──runtime.sendMessage──> background ──> providers
content <──window.postMessage──> injected (MAIN world)
background ──offscreen document──> whisper engine   (Chrome)
background ──────────────────────> whisper engine   (Firefox, in-process)
settings ──storage.local────────> background + content (CACHE_CLEARED via tabs.sendMessage)
```

## Files

| Doc | Subject |
|---|---|
| [architecture.md](./architecture.md) | bundles, hosting, message protocol, generation guard |
| [whatsapp-dom.md](./whatsapp-dom.md) | the DOM contract: selectors, box, animations, timestamp rules |
| [whatsapp-internals.md](./whatsapp-internals.md) | MAIN-world modules, downloads S1/S2/S3, chat names, monitor |
| [providers.md](./providers.md) | the four providers, payloads, keys, language behavior |
| [local-whisper.md](./local-whisper.md) | the in-browser Whisper engine and its constraints |
| [storage.md](./storage.md) | flat settings keys, Zod defaults, cache schema |
| [i18n.md](./i18n.md) | locales, detection, interpolation, manifest strings |
| [conventions.md](./conventions.md) | cross-cutting summary; defers to AGENTS.md |
