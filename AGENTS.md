# Transcreve.ai — AGENTS.md

Hard rules for agents. Detail lives in `docs/`. Read `docs/README.md` first.

## Architecture

- Single-package browser extension (Chrome MV3 + Firefox MV3). No workspaces. Yarn for scripts.
- One IIFE bundle per entrypoint, built by `scripts/build.ts` into `dist/chrome` and `dist/firefox`.

| Entrypoint | Output | Runs in |
|---|---|---|
| `src/background/index.ts` | `background.js` | service worker (Chrome) / event page (`background.scripts`, Firefox) |
| `src/content/index.ts` | `content.js` | isolated world on `web.whatsapp.com` |
| `src/injected/index.ts` | `injected.js` | `world: MAIN`, self-contained |
| `src/settings/index.ts` | `settings.js` | `popup.html` and `options.html` |
| `src/offscreen/index.ts` | `offscreen.js` | Chrome offscreen document (local Whisper) |
| `src/whisper/worker.ts` | `whisper-worker.js` | Web Worker that owns the Whisper pipeline |

```
content ──runtime.sendMessage──> background ──> providers
content <──window.postMessage──> injected (MAIN world)
background ──offscreen document──> whisper engine   (Chrome)
background ──────────────────────> whisper engine   (Firefox, in-process)
settings ──storage.local────────> background + content (`CACHE_CLEARED` via tabs.sendMessage)
```

## Hard Rules

1. **100% TypeScript.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `noUnusedLocals`, `noUnusedParameters`. No `any`. `unknown` plus type guards.
   `as` only inside `src/injected/whatsapp/` (WhatsApp internals, see `docs/whatsapp-internals.md`),
   in `src/shared/messaging.util.ts` (the webextension-polyfill listener type cannot express
   "this message is not mine") and in `src/whisper/worker.ts` (the DOM lib has no
   `DedicatedWorkerGlobalScope`).
2. **Zero comments** in `src/`, `tests/`, `public/` (CSS and HTML included). Names and structure
   carry meaning; behavior lives in `docs/`.
3. **Identifiers in English.** Every user-facing string goes through `@/shared/i18n`.
4. **File size**: preferred ≤350 lines, soft review >400, split before adding logic when >600,
   new file ≤500. Entrypoints wire only (≤120 lines).
5. **No dead code, no unused exports, no compatibility shims, no dual-read/dual-write.**
   Persisted state is Zod-validated with defaults: an unknown or invalid value becomes the
   default; there is no migration branch.
6. **Imports**: `@/*` maps to `src/*`. Relative paths inside a feature folder are extensionless.
7. Suffixes: `*.provider.ts`, `*.store.ts`, `*.bridge.ts`, `*.guard.ts`, `*.util.ts`.
8. `camelCase` values, `PascalCase` types, `UPPER_CASE` constants.
9. Traceability: changing a type updates every dependent in the same change.

## Boundaries (`yarn validate:boundaries`)

- `src/shared/**` imports nothing from `background/`, `content/`, `injected/`, `settings/`, `whisper/`.
- `src/content/**` imports from `background/**` never; only the message contract in `shared/`.
- `src/injected/**` imports only `@/shared/` types and constants: it is injected into the page's
  MAIN world and cannot depend on extension-only modules.
- `console` only in `src/shared/logger.ts`.

## Commands

| Command | What it does |
|---|---|
| `yarn dev` | esbuild watch → `dist/chrome` and `dist/firefox` |
| `yarn build` | typecheck, then bundles, manifests, static and vendor into both targets |
| `yarn package` | zip both targets as `transcreve-ai-<version>-<target>.zip` |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn lint` | eslint flat config |
| `yarn test` / `yarn test:watch` | vitest (jsdom) |
| `yarn vendor` | copy the pinned Whisper runtime from `node_modules` into the targets |
| `yarn validate[:comments\|:file-size\|:boundaries\|:i18n\|:manifest]` | guardrails |

Package a build with `yarn package`; it writes `transcreve-ai-<version>-<target>.zip` for
both browsers, with `/` separators on every platform.

## Dependencies

- Bundled: `webextension-polyfill` (typed promise API on both browsers), `zod`.
- The Whisper runtime is never bundled: `scripts/vendor.ts` copies it from pinned devDeps —
  `@huggingface/transformers@4.3.1` plus the exact `onnxruntime-web@1.31.0-dev.20260914-8d85527a0`
  it pins. The engine's `import()` argument is a runtime value, which is what keeps esbuild from
  inlining it. `docs/local-whisper.md` explains why the `.wasm` must ship locally.

## Testing

- Vitest + jsdom. `tests/` mirrors `src/`.
- `it()` descriptions in Portuguese.
- Fragile logic is extracted into pure functions: layout math, cache, i18n, message guards,
  provider payloads, recency filter.
- `vi.mock('webextension-polyfill')`, `vi.mock('@huggingface/transformers')`. Inline fixtures only.
- No coverage threshold; 90% is aspirational.

## Docs

- Same change as code: update the matching file in `docs/`.
- Code and docs conflict: trust the executable source and fix the doc in the same delivery.
- `docs/conventions.md` is the cross-cutting summary and defers to this file.

## Checklist

- [ ] Boundaries and file-size rules respected
- [ ] Zero comments; English identifiers; no dead code; no compat shims
- [ ] Every user-facing string in `@/shared/i18n`, all locales updated
- [ ] Tests added or updated on the mirrored path
- [ ] Matching `docs/` file updated
- [ ] `yarn typecheck && yarn lint && yarn test && yarn validate && yarn build` green
