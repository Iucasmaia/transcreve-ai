# Conventions

Cross-cutting summary. [AGENTS.md](../AGENTS.md) holds the hard rules and wins on any
conflict; this file only adds the reasoning and the pointers.

## Naming and layout

Values are `camelCase`, types are `PascalCase`, constants are `UPPER_CASE`. File
suffixes carry meaning: `*.provider.ts` (a transcription backend), `*.store.ts`
(persistence), `*.bridge.ts` (a message boundary), `*.schema.ts` (Zod), `*.util.ts`
(small pure helpers). Imports use `@/*` for `src/*` and extensionless relative paths
inside a feature folder.

## Size

Preferred 350 lines, soft review above 400, split before adding logic when a file
already exceeds 600, new files at most 500. Entrypoints wire only, at most 120 lines —
`yarn validate:file-size` enforces the entrypoint cap and the hard cap on every source
and test file.

## Comments

Zero comments in `src/`, `tests/` and `public/`, including CSS and HTML. Behaviour that
would otherwise need a comment belongs in `docs/`. `yarn validate:comments` scans the
TypeScript AST for real comment ranges and the static assets for comment markers, and
fails the build when it finds one.

## Boundaries

`shared/` is cross-cutting only: it may not import from `background/`, `content/`,
`injected/`, `settings/` or `whisper/`. `content/` never imports from `background/`,
only the message contracts. `injected/` ships into the page's MAIN world, so it may
import nothing but `@/shared/types`. `console` is allowed only in `src/shared/logger.ts`.
All of it is checked by `yarn validate:boundaries`.

## State

Persisted state is validated with Zod and per-field defaults: an unknown or invalid
value becomes the default, never a migration branch. No dual reads, no compatibility
shims, no renamed aliases for old names. When a contract changes, every consumer changes
in the same delivery.

## Tests

Vitest with jsdom, files under `tests/` mirroring `src/`. Descriptions are written in
Portuguese (`it('descreve o cenário')`). Fragile logic is extracted into pure functions
taking measured values as arguments, so it can be tested without a browser layout:
layout math, cache pruning, i18n, message guards, provider payloads and the recency
filter. External modules are mocked with `vi.mock`, fixtures are inline, and there is no
coverage threshold — 90% is the goal, not a gate.

## Delivery checklist

`yarn typecheck && yarn lint && yarn test && yarn validate && yarn build` must be green,
the matching `docs/` file updated, and both `dist/chrome` and `dist/firefox` loaded
manually before a change is considered done.
