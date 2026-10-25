# Chrome Web Store — formulário de Privacidade (textos para colar)

Cada campo aceita até 1000 caracteres. Os textos abaixo estão dentro disso e são coerentes
com o `PRIVACY.md` — o formulário exige que as duas coisas batam.

## Único propósito

```
Transcrever as mensagens de voz do WhatsApp Web que o próprio usuário já pode reproduzir na
sua sessão, exibindo o texto dentro da própria mensagem de áudio. O provedor é escolha do
usuário: Whisper local, que roda no navegador e não envia o áudio para fora, ou um provedor
de nuvem (AssemblyAI, OpenAI ou Google Gemini) usando a chave de API do próprio usuário. A
extensão também pode transcrever automaticamente as mensagens de voz novas, conforme as
opções escolhidas pelo usuário, e mantém um cache local das transcrições.
```

## Justificativa de storage

```
Guarda, apenas no armazenamento local do navegador do usuário: as preferências (provedor,
modelo, idioma do áudio, idioma da interface, tema, modo de transcrição automática e filtros
por tipo de conversa), as chaves de API digitadas pelo usuário, as transcrições em cache (no
máximo 500, que o usuário apaga pelo painel) e o progresso do download do modelo local.
Nada é sincronizado para a nuvem e não temos servidor.
```

## Justificativa de scripting

```
Injeta um script de página em web.whatsapp.com para ler a mensagem de voz que a sessão do
usuário já pode reproduzir, sem tocar o áudio, e para observar a chegada de novas mensagens
de voz quando o usuário liga a transcrição automática. O script não modifica o WhatsApp, não
envia nada por conta própria e não acessa mensagens que a sessão não poderia abrir.
```

## Justificativa de activeTab

```
Necessária apenas para injetar esse script na aba ativa do WhatsApp Web quando o usuário
interage com a extensão. Não é usada para ler outras abas nem para outra finalidade.
```

## Justificativa de offscreen

```
Executa o motor do Whisper local em um documento offscreen, porque o service worker do
Manifest V3 não tem AudioContext e não comporta a inferência. É usado somente quando o
usuário escolhe o provedor Local: o áudio é decodificado e transcrito ali, dentro do
navegador, sem enviar nada para fora.
```

## Justificativa de Permissão do host

```
web.whatsapp.com — é o único site em que a extensão atua.

api.assemblyai.com, api.openai.com, generativelanguage.googleapis.com — chamar o provedor de
transcrição que o usuário escolher, autenticando com a chave de API dele. Nenhum desses
hosts é acessado quando o provedor Local está selecionado.

huggingface.co, *.huggingface.co, *.hf.co — baixar os pesos do modelo Whisper usado pelo
provedor Local. É um download único de dados (arquivos ONNX); nenhum áudio, transcrição ou
identificador de usuário é enviado ao Hugging Face.
```

## Você está usando código remoto?

Marque **Não, não estou usando Código remoto**.

## Justificativa (código remoto)

```
Nenhum código remoto é executado. Todo o JavaScript vem no pacote e o WebAssembly do ONNX
Runtime está incluído na pasta vendor/ e é carregado da própria extensão. O único download
externo do provedor Local são os pesos do modelo Whisper, tratados como dados (arquivos
ONNX) e nunca avaliados como código. Não há eval(), nem módulos apontando para arquivos
externos, nem tags de script remotas.
```

## Uso de dados — o que marcar

| Categoria | Marcar? | Por quê |
|---|---|---|
| Informações de autenticação | **Sim** | a chave de API que o usuário digita vai para o provedor escolhido |
| Comunicações pessoais | **Sim** | o áudio da mensagem de voz é o conteúdo transcrito |
| Conteúdo do site | **Sim** | esse áudio é conteúdo (som) retirado da página |
| Identificação pessoal, saúde, financeiro, local, histórico da Web, atividade do usuário | Não | nada disso é lido nem transmitido |

Declarar a mais é mais seguro do que a menos: a revisão compara o formulário com a política
de privacidade, e uma omissão é motivo de rejeição.

### Explicação por categoria

**Informações de autenticação**

```
Somente a chave de API que o usuário digita. Ela fica no armazenamento local do navegador e
é enviada apenas ao provedor que o próprio usuário escolhe para transcrever. Não temos
servidor e não recebemos essa chave.
```

**Comunicações pessoais**

```
O áudio da mensagem de voz que o usuário escolhe transcrever. Com o provedor Local ele não
sai do navegador. Com um provedor de nuvem, é enviado diretamente ao provedor escolhido,
autenticado com a chave do usuário. Nenhum histórico, nome de contato ou metadado da conversa
é enviado, e o áudio não é armazenado pela extensão.
```

**Conteúdo do site**

```
Apenas o áudio da mensagem de voz selecionada na página do WhatsApp Web — não o restante do
conteúdo da página. É lido uma vez, para a transcrição pedida pelo usuário, e não é
armazenado pela extensão.
```

## As três declarações

Marque as três:

- Não vendo nem transfiro dados do usuário a terceiros fora dos casos de uso aprovados.
- Não uso nem transfiro dados do usuário para fins não relacionados ao único objetivo do meu item.
- Não uso nem transfiro dados do usuário para determinar credibilidade ou para fins de empréstimo.

## URL da Política de Privacidade

O campo é obrigatório e o link precisa abrir **sem login**. Use a URL pública do
`PRIVACY.md` no repositório:

```
https://github.com/Iucasmaia/<nome-do-repo>/blob/main/PRIVACY.md
```

Se preferir uma página mais apresentável, publique o repositório com GitHub Pages e use a URL
do Pages. Em qualquer caso, o texto publicado tem de ser o mesmo do arquivo — o formulário
certifica que as divulgações refletem a política atual.

## Instruções de acesso à funcionalidade principal

Este campo vai para o revisor, e o revisor pode não ler português. Use a versão em **inglês**
(abaixo); a versão em português fica como referência e para o caso de a revisão ser
localizada.

### Versão em inglês (colar no formulário)

```
No account or API key needed: the default provider is Local (Whisper), which downloads its model once (~77 MB, progress in the panel).

Open web.whatsapp.com, sign in, open a chat with a voice message and click the green mic button. The audio downloads silently (nothing plays), dots appear, then the text is typed in the bubble. Click again to re-transcribe.

Set Model to whisper-tiny for a faster first run. Automatic transcription is on by default.
```

### Versão em português

```
Não é preciso conta nem chave: o provedor padrão é o Local (Whisper), que baixa o modelo uma vez (~77 MB, com progresso no painel).

Abra web.whatsapp.com, entre, abra uma conversa com áudio e clique no microfone verde. O áudio baixa em silêncio (nada toca), aparecem pontinhos e o texto é digitado no balão. Clique de novo para repetir.

Modelo whisper-tiny deixa o primeiro teste mais rápido. A transcrição automática vem ligada.
```

### Por que este texto funciona na revisão

- **Não pede credencial**: o padrão é o provedor Local, então o revisor testa o fluxo inteiro
  (botão, download, transcrição, cache, painel) sem conta em nenhum serviço.
- **Diz o que esperar**: download único de ~77 MB e quanto tempo isso leva é a primeira coisa
  que trava um revisor que acha que a extensão "não funciona".
- **Explica o silêncio**: o áudio é baixado sem tocar, o que parece bug se não for avisado.
- **Dá a alternativa leve**: `whisper-tiny` (~41 MB) para máquina ou conexão fraca.
- **Escopa a automação**: a transcrição automática vem ligada, então o revisor pode ver caixas
  aparecendo sem clicar em nada — dito de antemão, deixa de parecer comportamento estranho.

