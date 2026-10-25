# Storage

All state lives in `storage.local` (never synced). Nothing is read from `storage.sync`.

## Settings

Flat keys, validated by the Zod schema in `src/shared/settings.schema.ts`:

| Key | Values | Default |
|---|---|---|
| `provider` | `assemblyai` \| `openai` \| `gemini` \| `local` | `local` |
| `languageMode` | `auto` \| `manual` | `auto` |
| `languageCode` | language code | `pt` |
| `autoMode` | `off` \| `chat` \| `all` | `all` |
| `autoContacts` | boolean | `true` |
| `autoGroups` | boolean | `true` |
| `autoChannels` | boolean | `false` |
| `uiLanguage` | `auto` or a locale id | `auto` |
| `panelTheme` | `light` \| `dark` \| `null` | `null` (follow the system) |
| `assemblyApiKey`, `openaiApiKey`, `geminiApiKey` | string | `""` |
| `openaiModel`, `geminiModel`, `localModel` | string | provider defaults |

Every field is declared with `.catch(default)`, so a missing, unknown or invalid value
becomes the default instead of throwing. There is no migration branch by design: the
schema *is* the contract. `KEY_FIELDS` and `MODEL_FIELDS` map each provider to its
storage key, so panel and background can never disagree about the names.

The shipped defaults are Local (Whisper), the audio language on automatic and automatic
transcription for all conversations; channels stay excluded until they are enabled.
Because the defaults live in the schema, they apply to fresh installs only — a browser
that already has values stored keeps them.

The `local` provider has no key field, and AssemblyAI has no model field.

## Model download progress

`localModelProgress` is written by the Whisper engine while the model weights download:
`model`, `state` (`idle` | `downloading` | `ready` | `error`), `file`, `percent`,
`error` and `updatedAt`. The panel only reads it; it is not part of the settings
contract, and a missing value means nothing has been downloaded yet.

## Cache

`waTrCache` holds a `Record<msgId, CacheEntry>`:

| Field | Meaning |
|---|---|
| `text` | the transcript |
| `ts` | write timestamp, used for pruning |
| `chatId` | JID resolved through the MAIN-world bridge |
| `chatName` | contact/group display name at transcription time |

`parseCache` validates the whole store and drops anything invalid. `pruneCache` keeps
the newest `MAX_CACHE_ENTRIES` (500) entries by `ts`. Entries written before the
chat metadata existed are completed later: when a conversation opens, the content
script asks the page for `CHAT_INFO` and backfills `chatId`/`chatName`, and
`chatIdFromEntry` still derives the JID from the `msgId` shape as a fallback.

Clearing writes or removes `waTrCache` and then notifies the open WhatsApp tabs with
`CACHE_CLEARED` (`scope: "chat"` plus a `chatId`, or `scope: "all"`), which the content
script validates with `isCacheClearedMessage` before removing the affected boxes.
