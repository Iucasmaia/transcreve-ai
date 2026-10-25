# Store listing — Chrome Web Store

Copy ready to paste. Portuguese (Brazil) is the primary locale; add other locales later
from the same texts, they already exist in `src/shared/i18n/locales/`.

## Item name

```
Transcreve.ai
```

## Summary (max 132 characters)

```
Transcreva mensagens de voz do WhatsApp Web no navegador, sem enviar áudio para fora. Também com AssemblyAI, OpenAI ou Gemini.
```

## Detailed description

```
Transcreve.ai adiciona um botão ao lado de cada mensagem de voz no WhatsApp Web e mostra a
transcrição dentro do próprio balão, logo abaixo do player, com botão de copiar.

QUATRO PROVEDORES

• Local (Whisper) — padrão. Baixa o modelo uma vez do Hugging Face (~40 a 80 MB) e transcreve
  no seu navegador por WebAssembly. O áudio NÃO sai da sua máquina. Sem chave de API.
• AssemblyAI, OpenAI e Google Gemini — com a sua própria chave de API, enviando o áudio
  somente ao provedor que você escolher.

COMO FUNCIONA

Clique no botão da mensagem de voz. O áudio é baixado nos bastidores, sem reproduzir nada.
Três pontinhos animados, depois o texto aparece sendo digitado dentro do balão. Clicar de
novo transcreve outra vez com o provedor ou modelo atual.

RECURSOS

• Transcrição automática: desligada, só na conversa aberta ou em todas as conversas, com
  filtros para contatos, grupos e canais. Só mensagens novas, nunca o histórico antigo.
• Idioma automático detectado a partir do áudio, ou fixo.
• Cache local das transcrições (até 500), com lista por conversa e limpeza por conversa ou
  total.
• Tema claro/escuro e interface em inglês, português (Brasil e Portugal), espanhol, francês,
  italiano e russo.

PRIVACIDADE

Não temos servidor, conta, analytics nem anúncios. As chaves de API e as transcrições ficam
apenas no armazenamento local do seu navegador. Com o provedor Local o áudio nunca sai do
computador; com os provedores de nuvem ele vai direto para o provedor escolhido, usando a sua
chave.

Política de privacidade completa e aviso legal (sem vínculo com WhatsApp ou Meta) nos links
abaixo.
```

## Category, language, links

| Field | Value |
|---|---|
| Category | Productivity (Produtividade) |
| Language | Portuguese (Brazil) |
| Privacy policy | the hosted `PRIVACY.md` URL |
| Support / homepage | `https://github.com/Iucasmaia` |

## Single purpose (required field)

```
Transcrever as mensagens de voz do WhatsApp Web em texto e exibir a transcrição dentro da
própria mensagem.
```

## Permission justifications

| Permission | Justification (paste) |
|---|---|
| `storage` | Guarda localmente as configurações, as chaves de API digitadas pelo usuário, as transcrições em cache e o progresso do download do modelo. |
| `scripting` | Injeta o script de página que lê a mensagem de voz que a própria sessão do usuário no WhatsApp Web já pode reproduzir. |
| `activeTab` | Acessa a aba ativa do WhatsApp Web apenas para injetar esse script. |
| `offscreen` | Executa o motor Whisper local fora do service worker, que não tem `AudioContext`. |
| Host — `web.whatsapp.com` | É o site onde a extensão atua. |
| Host — `api.assemblyai.com`, `api.openai.com`, `generativelanguage.googleapis.com` | Chamar o provedor de transcrição que o usuário escolher, com a chave dele. |
| Host — `huggingface.co`, `*.huggingface.co`, `*.hf.co` | Baixar os pesos do modelo Whisper usado pelo provedor local (download de dados, não de código). |

## Data usage answers

| Question | Answer |
|---|---|
| Does the item collect user data? | **Yes**, with the disclosures below. |
| What is collected | **Audio** (only the voice note being transcribed) and **authentication information** (the user's own API key). |
| Is it sold to third parties? | No. |
| Used for purposes unrelated to the single purpose? | No. |
| Used for creditworthiness or lending? | No. |
| Transferred off device | Only to the transcription provider the user selects; with the Local provider nothing leaves the device. |
| Data retention | Transcripts stay in the browser's extension storage until the user clears them or removes the extension; audio is not stored by the extension. |

## Remote code

Answer **No**. All executable code ships inside the package: the ONNX WebAssembly runtime
is in `vendor/` and is loaded from the extension itself. The Whisper model weights are
downloaded from Hugging Face as **data** (they are never executed as code) and are cached by
the browser.

## Screenshots to prepare

- Panel open with the Local provider selected and the model progress bar downloading.
- A voice message with the transcript inside the bubble and the copy button.
- The panel's automatic-transcription section with the type filters.
- The panel's cache section with conversations listed.

Chrome accepts 1280×800 or 640×400 (JPEG or 24-bit PNG). The 128×128 icon is already inside
the package.
