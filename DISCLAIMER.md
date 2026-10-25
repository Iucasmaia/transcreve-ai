# Legal notice and disclaimer

Transcreve.ai is an independent project. It is **not** affiliated with, endorsed by,
sponsored by or otherwise connected to WhatsApp LLC, Meta Platforms, Inc., or any of
their subsidiaries or affiliates.

## Trademarks

WhatsApp, WhatsApp Web, the WhatsApp name and the WhatsApp logo are trademarks of Meta
Platforms, Inc. The word "WhatsApp" appears in this project only to describe
interoperability: the extension runs on the WhatsApp Web page inside your own browser.
No ownership is claimed over any third-party trademark, and no third-party logo, font or
asset is distributed with this project.

## No content, no hosting, no server

This project does not host, store, copy, index or distribute any WhatsApp content, and
it operates no server of its own. It is a client-side tool: it reads voice messages that
your own logged-in browser session already has access to, transcribes them (locally, or
through a provider you configure with your own API key) and displays the text on the
page. Media keys are used only inside your session, only for audio that session is
already authorised to play, using the keys WhatsApp itself provides to that session.
Transcripts are kept in the browser's local extension storage on your machine.

## Copyright and DMCA

The repository contains no WhatsApp code, markup, font, image, audio or trademark file.
It ships original source code plus two third-party runtime libraries under their own
licences (listed below). If you believe that any material in this project infringes your
rights, contact the maintainer through https://github.com/Iucasmaia — open an issue or
send a message — and the material will be reviewed and removed or replaced promptly.

## Third-party components

| Component | Purpose | Licence |
|---|---|---|
| `@huggingface/transformers` (transformers.js) | Whisper inference in the browser | Apache-2.0 |
| `onnxruntime-web` | ONNX runtime compiled to WebAssembly | MIT |
| `webextension-polyfill` | Promise-based WebExtension API on both browsers | MPL-2.0 |
| Whisper model weights | downloaded at runtime from Hugging Face when you use the local provider | defined by each model repository |

The model weights are fetched from Hugging Face on first use of the local provider and
are not redistributed here.

## Terms of service and responsibility

Your use of WhatsApp Web remains governed by WhatsApp's own Terms of Service. This
project is not a WhatsApp client, does not modify WhatsApp, and does not offer any
capability that your session does not already have. You are responsible for using it in
accordance with those terms, with the rights of the people in your conversations, and
with the laws that apply where you are. Transcribing other people's audio may require
their consent.

## No warranty

The software is provided "as is", without warranty of any kind, express or implied,
including but not limited to the warranties of merchantability, fitness for a particular
purpose and non-infringement. The authors are not liable for any claim, damage or other
liability arising from the use of the software.

## Not legal advice

This notice describes the project's intent and scope. It is not legal advice. If you
need a legal opinion about your own use case, consult a qualified professional.
