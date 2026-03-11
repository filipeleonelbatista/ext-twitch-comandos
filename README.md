# Extensão Twitch – Comandos de áudio (colonogamer)

Extensão do tipo **Panel** para o canal [colonogamer](https://www.twitch.tv/colonogamer) na Twitch. Permite que a audiência envie comandos de áudio para o chat com um clique; os comandos vêm de duas planilhas Google (seguidores e inscritos), com filtros por categoria. Inscritos desbloqueiam a lista extra de áudios.

## Conteúdo do repositório

- **Next.js** (App Router): panel em `app/page.jsx`, API routes em `app/api/` (sub-check, auth, auth/callback).
- **Documentação**:
  - [Como usar](docs/uso.md) – para viewers.
  - [Configuração](docs/configuracao.md) – como configurar e publicar a extensão e as planilhas.
  - [Contexto para IA](docs/project.md) – resumo do projeto para assistentes de código.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para testar como extensão, use essa URL no [teste local da extensão](https://dev.twitch.tv/docs/extensions/tutorials/local-test) (Developer Console → sua extensão → Teste local).

## Deploy (um único projeto)

```bash
npm run build
npm run start
```

Em plataformas como **Vercel**, faça o deploy do repositório (build: `next build`). Tudo roda no mesmo domínio:

- **Panel**: `https://seu-dominio.com` (página inicial).
- **API (EBS)**:
  - `POST /api/sub-check` – verificação de inscrito
  - `GET /api/auth` – início do OAuth do broadcaster
  - `GET /api/auth/callback` – callback do OAuth

No Twitch Developer Console:

- **Panel Viewer Path**: `https://seu-dominio.com`
- **EBS URL**: `https://seu-dominio.com` (mesmo domínio)

Configure as variáveis de ambiente (veja `.env.example`): `EXTENSION_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` (URL pública do app, para o redirect do OAuth). O streamer deve acessar `GET https://seu-dominio.com/api/auth` uma vez para autorizar a verificação de inscritos.

## Testar localmente

1. `npm run dev` e use `http://localhost:3000` no teste local da extensão.
2. Defina `NEXT_PUBLIC_APP_URL=http://localhost:3000` no `.env` para o callback do OAuth (e use uma URL exposta, ex. ngrok, se o Twitch não acessar localhost).
3. Após publicar, teste em desktop e mobile na live do canal.

## Aprendizados do projeto

- **Extensões Twitch**: uso do Extension Helper, fluxo `onAuthorized`, envio de mensagem no chat via API “Send Extension Chat Message” e limite de 12 msg/min por viewer.
- **Verificação de inscrito sem Monetization**: backend que valida o JWT do viewer e chama a Helix (Check User Subscription) com o token do broadcaster e escopo `channel:read:subscriptions`.
- **Next.js API Routes como EBS**: um único deploy (panel + backend); rotas em `app/api/` para sub-check e OAuth do broadcaster.
- **Dados em tempo quase real**: Google Sheets publicados em CSV; polling no frontend para atualizar a lista de comandos.
- **UX em panel**: filtro por categoria e feedback de rate limit (ex.: “Aguarde X segundos”) para desktop e mobile.

## Canal e autor

- **Canal**: [colonogamer](https://www.twitch.tv/colonogamer)  
- **Desenvolvido por**: [filipeleonelbatista](https://www.twitch.tv/filipeleonelbatista) (Twitch)

---

Feito pelo maior exemplo dessa live.  
**[Filipe Leonel Batista](https://www.linkedin.com/in/filipeleonelbatista)** · LinkedIn
