# Local Whisper

`src/whisper/` runs Whisper entirely inside the browser. No key, no server, and the
audio never leaves the machine.

## Runtime

The runtime is not bundled. `scripts/vendor.ts` copies it from pinned devDependencies
into `dist/<target>/vendor`:

- `transformers.min.js` from `@huggingface/transformers@4.3.1`;
- `ort-wasm-simd-threaded.asyncify.mjs` and `.wasm` from the exact
  `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` that transformers pins.

The version pin matters: the loader `.mjs` and the `.wasm` must come from the same
build as the ONNX runtime inside the transformers bundle.

## Why the `.wasm` must ship locally

The web build of transformers defaults `env.backends.onnx.wasm.wasmPaths` to
`https://cdn.jsdelivr.net/npm/onnxruntime-web@<version>/dist/`. MV3 forbids remote code
(`script-src 'self'`), so that default would break the local provider. The engine
therefore overrides the paths right after importing the runtime: it assigns
`wasmPaths` directly when the ONNX backend is already published, and otherwise installs
a property setter on `env.backends` so the assignment made later (lazy ONNX load) still
carries the local paths.

It also sets `env.useWasmCache = false`. With the cache enabled, transformers pre-loads
the loader `.mjs` and hands it over as a `blob:` URL, which the extension CSP may block;
turning it off makes the runtime import the extension URL directly.

## Pipeline options

- `dtype: "q8"` (quantized weights), `device: "wasm"` with a fallback to `"cpu"` when
  the device is unavailable.
- `chunk_length_s: 30`, `stride_length_s: 5`, so long voice notes are transcribed in
  windows instead of being truncated.
- `allowLocalModels: false`, `allowRemoteModels: true`: weights come from Hugging Face
  as data and are cached by the browser.

## Language detection

transformers.js does **not** detect the language. Without `language` it logs
"No language specified - defaulting to English (en)." and transcribes in English. The
engine runs the detection itself: one decoder step with only the
`decoder_start_token_id`, then it reads the predicted token and maps it to a language
code. Detection uses the first 30 seconds, like the original Whisper. When the mode is
manual, the chosen language is passed and no detection runs. English-only models
(`is_multilingual === false`) receive neither `task` nor `language`, because the runtime
rejects both for them.

## Threading

The ONNX session never runs on the host document's main thread. The host page (offscreen
document on Chrome, background page on Firefox) decodes the audio with
`OfflineAudioContext` and posts the resulting `Float32Array` to `whisper-worker.js`, which
owns the pipeline and emits download progress; the host persists it, because a worker has
no extension storage API on Firefox. That is what keeps the panel responsive while a
transcription runs: the offscreen document, the popup and the options page share the
extension's renderer process, so an inline inference used to freeze the panel until the
audio finished. Audio decoding stays on the host because a worker has no `AudioContext`.

## Download progress

Selecting the Local provider in the panel sends `PRELOAD_LOCAL_MODEL`. The background
then builds the pipeline — through the offscreen document on Chrome, in-process on
Firefox — which is what triggers the weight download. transformers' `progress_callback`
feeds `localModelProgress` in `storage.local`, throttled to one write per 400 ms, and
the panel renders a bar from it. Nothing has to be clicked to start the download and
the bar exists only so the user can watch it. The entry ends as `ready` (100%) or
`error` with the failure message; the same callback is active during a transcription,
so a first transcription also fills the bar.

## Hosting and cost

On Chrome the engine runs in an offscreen document created on demand; on Firefox it
runs in the background page. The pipeline is kept in memory per model, so the second
transcription skips the load. Model weights are ~41 MB for `whisper-tiny` and ~77 MB for
`whisper-base` (quantized encoder plus decoder); the first run downloads them and is
much slower. `whisper-base` runs at roughly 1x-3x the audio duration on a normal
laptop; `whisper-tiny` is faster but makes many mistakes in Portuguese.
