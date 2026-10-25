# WhatsApp internals (MAIN world)

`src/injected/` runs inside WhatsApp's own JavaScript realm: the manifest declares it
with `"world": "MAIN"` at `document_start`. It is self-contained by contract — it may
import nothing but `@/shared/types` — and it is the only place allowed to use `as` and
loose typing, because the WhatsApp internals are undocumented and typed loosely in
`src/injected/whatsapp/types.ts`.

Everything crosses the boundary through `window.postMessage` with `source` validation
and `requestId` correlation (`src/injected/bridge.ts`).

## Modules

`src/injected/whatsapp/modules.ts` resolves the page's module loader (`require`-style)
and waits for it, retrying while WhatsApp boots. The module id map covers the
collections, the download manager, group metadata and contacts, plus a fallback that
scans the loader's model list when an id disappears after a WhatsApp update. The
message store is looked up in `WAWebCollections.Msg` and, failing that, in
`WAWebMsgCollection.MsgCollection`. Getters return `undefined` instead of throwing.
Failures raise `StageError`, whose message carries a `stage:` prefix that the content
script translates into a short code in the box.

## Silent download

Three strategies, tried in order, none of which plays audio:

1. **S1** — `msg.downloadMedia(...)` plus the in-memory blob cache
   (`WAWebMediaInMemoryBlobCache`, `mediaObject.mediaBlob`).
2. **S2** — the download manager (`WAWebDownloadManager.downloadAndMaybeDecrypt` and
   variants) using the message metadata.
3. **S3** — fetch the `.enc` from the CDN (`mmg.whatsapp.net` + `directPath`) and
   decrypt it with the `mediaKey`: HKDF-SHA256 with the `WhatsApp Audio Keys` info,
   AES-256-CBC, with the trailing 10 bytes used as the MAC.

The captured audio is reported as base64, MIME type and byte size.

### Stage codes

`timeout`, `leitura-falhou`, `require-indisponivel`, `mensagem-nao-encontrada`,
`midia-indisponivel`, `download-falhou`, `decrypt-sem-dados`, `decrypt-download-falhou`,
`decrypt-arquivo-invalido`, `decrypt-mac-invalido`. The content script also raises
`sem-id`, `pagina-nao-pronta` and `timeout-resposta` for its own failures. Each one maps
to a translated message; the raw code stays visible in the box for support.

## Chat identity

`src/injected/chat-info.ts` resolves the display name in the same order
`whatsapp-web.js` uses: `msg.chat.formattedTitle`, then
`WAWebCollections.Chat` by JID, then `GroupMetadata.subject`, then
`Contact.name`/`pushname`, then `msg.notifyName`. The DOM `msgId` is only a hash, so the
JID comes from `msg.id.remote`. The function returns empty strings instead of throwing:
a transcript without a chat name is still usable.

## New-message monitor

`src/injected/message-store.ts` listens to `WAWebCollections.Msg.on("add")` and adds a
4 second polling safety net for messages that arrive without firing the event. For every
new PTT message it applies, in this order:

1. the mode filter (`off`, `chat`, `all`) — `chat` requires the message to belong to the
   conversation currently open;
2. the type filter (contacts, groups, channels; channels are off by default);
3. the recency guard `isRecentEnough`, which compares `msg.t` (seconds or milliseconds)
   against the moment the monitor started, with a 60 second tolerance.

The order matters: the filters run before the download, so unwanted audio is never
fetched from the CDN. The recency guard is what keeps WhatsApp's lazily loaded history
from being transcribed when a conversation is opened or scrolled back.
