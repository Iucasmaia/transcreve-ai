# Architecture

## Bundles

Each entrypoint is bundled separately with esbuild as an IIFE (`scripts/build.ts`),
into `dist/chrome` and `dist/firefox`. `scripts/vendor.ts` copies the Whisper runtime
into `dist/<target>/vendor`, and `scripts/manifest.ts` writes the manifest for each
target from a single typed builder.

## Hosting

| Context | Background | Local Whisper engine |
|---|---|---|
| Chrome | service worker (`background.service_worker`) | offscreen document, created on demand |
| Firefox | event page (`background.scripts`) | the background page itself |

The service worker has no `AudioContext` and no real DOM, so anything that decodes
audio must run elsewhere. `src/background/providers/local.provider.ts` decides at call
time: when `chrome.offscreen` exists it sends `LOCAL_WHISPER_TRANSCRIBE` to the
offscreen document; otherwise it imports and runs `src/whisper/engine.ts` in-process,
which is the Firefox path.

## Message protocol

`content` to `injected` (MAIN world) uses `window.postMessage` with a `source` field
that both sides validate (`CONTENT_SOURCE` / `PAGE_SOURCE` in `src/shared/types.ts`).
Requests carry a `requestId`; responses echo it, and the content side rejects on
timeout. The response envelope is
`{ source, type: "RESPONSE", requestId, ok: true, payload }` or
`{ ..., ok: false, error }`.

`content` to `background` and `background` to `offscreen` use
`runtime.sendMessage` with the contracts in `src/shared/messages.ts`
(`TRANSCRIBE_AUDIO`, `LOCAL_WHISPER_TRANSCRIBE`). Every listener ignores messages that
are not its own by returning `undefined` without responding — see
`src/shared/messaging.util.ts`, which exists because the `webextension-polyfill`
listener type cannot express "not mine".

`settings` writes the flat settings directly to `storage.local` and notifies the open
WhatsApp tabs with `CACHE_CLEARED` through `tabs.sendMessage`.

## Stale content script guard

Reloading the extension does not reload `web.whatsapp.com`: the old content script
stays alive until the page is refreshed. `src/content/index.ts` writes a generation
token to `document.documentElement.dataset.waTrGen` on boot; an instance that finds a
different token stands down, so two content scripts never fight over the same DOM.

## Why the Whisper runtime is not bundled

`src/whisper/engine.ts` imports the runtime with `import(new URL("vendor/…", location.href))`,
where the argument is computed at runtime. esbuild cannot resolve it, so the 450 KB bundle
and the 27 MB ONNX WebAssembly stay as files under `vendor/` and are loaded on demand. That
is deliberate: bundling would inline a payload used only by the local provider, and it
would break the `wasmPaths` override described in [local-whisper.md](./local-whisper.md).
Using `location.href` instead of `runtime.getURL` keeps the engine free of extension APIs,
which matters because it runs inside a Web Worker, where Firefox does not expose `browser`.
