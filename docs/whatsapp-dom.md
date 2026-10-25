# WhatsApp DOM contract

The extension finds voice notes by probing a list of selectors and remembering the one
that worked. Everything below is a contract the code depends on; when WhatsApp changes
its markup, the constants at the top of `src/content/messages/find.ts` are the first
thing to inspect.

## Finding messages

- Play/pause elements are collected from the page; a message is a PTT voice note when
  its container holds such an element and the message id can be extracted.
- The message id comes from the closest `data-id` attribute (own or of a child); it has
  the shape `direction_jid_hash`. The hash alone is used to recover cached entries whose
  id changed after a WhatsApp update.
- The balloon is the closest ancestor that satisfies the balloon predicate; when it is
  not found the code falls back to the message container.

## Button placement

The transcribe button is inserted into a container placed right after the player. Three
modes exist, and the code degrades to the next one when a button does not become
visible:

1. the symbol mode (green mic over the audio avatar),
2. the pill mode (label next to the play control),
3. the fallback row after the waveform.

Once transcribed, the icon becomes a check and the label switches to the translated
"transcribed" string. The button is re-enabled after every run, so clicking again
re-transcribes with the current provider and replaces the box.

## Result box

The box is appended as the last element of the balloon, carries the `wa-tr-box` class
and a `data-state` attribute (`loading`, `done`, `error`). States:

- `loading`: the label plus three animated dots.
- `done`: header, text and the copy button.
- `error`: the friendly message plus a short code.

`wa-tr-instant` is added when the content comes from the persistent cache: it disables
every animation, so a transcript that is already known appears finished when the
message scrolls back into view.

## Animations

Open animation on first render, the header fading in, then the text typed
progressively while the bubble height grows to fit. The `wa-tr-box-reserve` class adds
bottom space when the timestamp is not found, so the text never runs under it.

## Timestamp versus duration

WhatsApp places the message timestamp as an absolutely positioned overlay, often on the
same row as the audio duration. The rules the code follows, in order:

1. **Classification by X**: the rightmost of the two candidate elements is the
   timestamp. Y is not used, because duration and timestamp can share the same row and
   Y becomes unstable.
2. **Stability lock**: once a pair is chosen for a message it is kept until one of the
   two elements disappears, so the choice cannot oscillate during animations.
3. **Coordinates in the real `offsetParent`**: positions are computed and applied in the
   timestamp's own offset parent; mixing coordinate systems produces huge offsets.
4. **Negative offsets are valid**: no `Math.max(0, ...)` clamping, and a zero-width
   measurement is not a reason to abort.
5. **`white-space: nowrap`** on the timestamp and on its children, so a repositioned
   timestamp cannot wrap into a vertical column.
6. **Nested leaf de-duplication**: when several nested nodes match, only the outermost
   is used.
7. **Sanity guard**: if the computed target would place the timestamp outside the
   message, the original inline style is restored instead of applying it.

The **duration element is never moved or styled**; only the timestamp may be
repositioned, and its font is matched to the duration's font so both numbers look alike.
The `data-wa-tr-pinned`, `data-wa-tr-orig-style` and `data-wa-tr-font` dataset entries
record the original state for that restore.
