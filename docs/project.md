# Contexto do projeto para IA

## O que é

Extensão Twitch do tipo **Panel** para o canal **colonogamer**. Permite que viewers enviem comandos de áudio para o chat da live clicando em botões. Os comandos vêm de duas planilhas Google (uma para todos os seguidores, outra só para inscritos). Inscritos veem as duas listas; não inscritos só a lista de seguidores.

## Stack

- **Next.js (App Router)**: uma única aplicação com panel e backend.
- **Frontend**: `app/page.jsx` (client component), Twitch Extension Helper, `lib/config.js`, `lib/sheets.js`, `lib/twitch.js`.
- **Backend (API Routes)**: `app/api/sub-check/route.js`, `app/api/auth/route.js`, `app/api/auth/callback/route.js`. Validação JWT com `jose`; store em memória em `lib/ebs-store.js`.
- **Dados**: Google Sheets publicados em CSV (URLs em `lib/config.js`). Coluna A = comando, Coluna B = categoria.

## Fluxo resumido

1. Viewer abre o panel (página inicial) → frontend carrega CSV das planilhas, chama `POST /api/sub-check` para saber se é sub.
2. Exibe lista de comandos (e lista extra de áudios se for sub), com filtro por categoria.
3. Ao clicar num comando → Send Extension Chat Message (Helix); o áudio na live é disparado pelo setup do streamer (bot/OBS/StreamElements).

## Regras de negócio

- **Seguidores**: veem apenas a planilha “seguidores”.
- **Inscritos (sub)**: veem planilha “seguidores” + planilha “inscritos” (áudios).
- Verificação de sub feita em `/api/sub-check` (Helix Check User Subscription), não via Monetization.
- Polling periódico às URLs CSV para atualizar a lista.

## Autor e canal

- **Canal**: [colonogamer](https://www.twitch.tv/colonogamer)
- **Desenvolvido por**: filipeleonelbatista (Twitch: [filipeleonelbatista](https://www.twitch.tv/filipeleonelbatista))

## Arquivos importantes

- Documentação: `docs/uso.md`, `docs/configuracao.md`, `docs/project.md`.
- Panel: `app/page.jsx`, `app/globals.css`, `app/layout.jsx`.
- API: `app/api/sub-check/route.js`, `app/api/auth/route.js`, `app/api/auth/callback/route.js`.
- Lib (client): `lib/config.js`, `lib/sheets.js`, `lib/twitch.js`. Lib (server): `lib/ebs-store.js`.
