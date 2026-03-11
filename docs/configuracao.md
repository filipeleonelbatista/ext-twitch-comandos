# Configuração da aplicação – Extensão Comandos de áudio

Instruções para configurar e publicar a extensão no canal **colonogamer** e manter as planilhas de comandos. O projeto usa **Next.js** com API Routes como backend (EBS).

---

## 1. Pré-requisitos

- Conta no [Twitch Developer Console](https://dev.twitch.tv/console) e extensão criada (tipo **Panel**).
- Planilha Google com duas abas publicadas na Web em CSV (ver seção 3).
- Hospedagem com suporte a Next.js (ex.: Vercel) com HTTPS.

---

## 2. Configuração no Twitch Developer Console

1. Acesse [Extensions](https://dev.twitch.tv/console/extensions) e selecione a extensão.
2. **Panel**  
   - **Panel Viewer Path**: URL da aplicação (ex.: `https://seu-dominio.vercel.app`). A página inicial do Next.js é o panel.
3. **Capabilities**  
   - Ative **Chat in Extensions** (obrigatório para enviar mensagens no chat).  
   - **Extension Backend Service (EBS)**: use a **mesma URL** do panel (ex.: `https://seu-dominio.vercel.app`). As rotas do backend ficam em `/api/sub-check`, `/api/auth`, `/api/auth/callback`.
4. **Versão**  
   - Não é necessário fazer upload de zip: o panel é servido pela URL. Teste em “Local Test” antes de enviar para revisão.

---

## 3. Planilhas Google

### Formato das planilhas

- **Coluna A**: comando a ser enviado no chat (ex.: `!comando`, `!comando1`, `!comando2`). Um comando por célula.
- **Coluna B**: categoria (ex.: Audios Colono, Audios Diversos, DBD, Audios IF).
- **Primeira linha**: cabeçalho (ex.: “Comando”, “Categoria”) — será ignorada pelo parser.

### Publicar para a extensão

1. Abra a planilha no Google Sheets.
2. **Arquivo → Compartilhar → Publicar na Web**.
3. Selecione a aba desejada e o formato **CSV**.
4. As URLs estão em `lib/config.js` (seguidores e inscritos). Ao editar a planilha e manter a publicação, a extensão atualiza no próximo polling.

---

## 4. Backend (API Routes)

O backend é feito com **Next.js API Routes** no mesmo projeto:

- **POST /api/sub-check**: recebe o JWT do viewer (header `Authorization: Bearer <token>`), valida, extrai `user_id` e `channel_id`, obtém o token do broadcaster (guardado após OAuth), chama a Helix **Check User Subscription** e retorna `{ isSubscriber: true/false }`.
- **GET /api/auth**: redireciona o streamer para o OAuth da Twitch (scope `channel:read:subscriptions`).
- **GET /api/auth/callback**: troca o `code` por token, obtém o broadcaster e guarda em memória (para produção com múltiplas instâncias, considere Redis/Vercel KV).

**Variáveis de ambiente** (copie `.env.example` para `.env` e preencha):

- `EXTENSION_SECRET`: segredo da extensão (Twitch Developer Console).
- `TWITCH_CLIENT_ID`: Client ID do app da Twitch.
- `TWITCH_CLIENT_SECRET`: Client Secret do app.
- `NEXT_PUBLIC_APP_URL`: URL pública do app (ex.: `https://seu-dominio.vercel.app`), usada no redirect do OAuth (`/api/auth/callback`).

O streamer (colonogamer) deve acessar **uma vez** `GET https://seu-dominio.com/api/auth` para autorizar; após o callback, o backend passa a verificar inscritos em `/api/sub-check`.

---

## 5. Build e deploy (Next.js)

```bash
npm install
npm run build
npm run start
```

Em **Vercel**: conecte o repositório, configure as variáveis de ambiente e faça o deploy. O build é `next build`. Use a URL gerada (ex.: `https://ext-twitch-comandos.vercel.app`) como **Panel Viewer Path** e **EBS URL** no Twitch Console.

---

## 6. Áudios na live

A extensão **só envia o texto do comando** para o chat (ex.: `!comando2`). Quem dispara o áudio na live é a sua configuração no OBS, StreamElements, bot de chat etc.

---

## 7. Resumo rápido

| Item | Onde |
|------|------|
| URLs das planilhas CSV | `lib/config.js` |
| Panel Viewer Path | Twitch Console → extensão → Panel → URL do app |
| Chat na extensão | Twitch Console → Capabilities → Chat in Extensions |
| EBS URL | Twitch Console → EBS → mesma URL do app |
| Variáveis de ambiente | `.env` (EXTENSION_SECRET, TWITCH_*, NEXT_PUBLIC_APP_URL) |
| Autorização do streamer | Acessar `GET /api/auth` uma vez |
