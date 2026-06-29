# Me dá minha Copa! 🏆

Bolão da Copa do Mundo 2026 com placar ao vivo, trivia diária e ranking por fase — feito para grupos de amigos via Cloudflare Tunnel.

## Funcionalidades

- **Palpites por jogo** — confirmação única e irreversível antes do início da partida
- **Trivia diária** — uma pergunta por dia sobre a Copa 2026
- **Placar ao vivo** — animação 🔴 AO VIVO com minutagem via API-Football (quando configurado)
- **Ranking por fase** — Fase de Grupos (congelado ao final) e Fase Eliminatória (do zero)
- **Foto de perfil** — avatar opcional por jogador (base64 no banco)
- **Painel admin** — gestão de jogadores e visão de todos os palpites por partida
- **Compartilhamento** — exposição via Cloudflare Tunnel com domínio personalizado

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TanStack Start + Vite |
| Roteamento | TanStack Router (file-based) |
| UI | Tailwind CSS 4 + Radix UI + shadcn/ui |
| Server functions | TanStack Start (`createServerFn`) |
| Banco | SQLite via `better-sqlite3` |
| Dados de jogos | [OpenFootball](https://github.com/openfootball/worldcup.json) |
| Placar ao vivo | [API-Football](https://dashboard.api-football.com) (100 req/dia grátis) |
| Deploy | Cloudflare Tunnel + PM2 |

## Pré-requisitos

- Node.js 24+
- npm 11+

## Instalação

```bash
git clone https://github.com/champanhehub/copa-palpites-trivia.git
cd copa-palpites-trivia
npm install
```

## Configuração

Crie o arquivo `.env` na raiz:

```env
# Credenciais do painel admin
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASS=sua_senha_segura

# Opcional: placar ao vivo (cadastro grátis em dashboard.api-football.com)
API_FOOTBALL_KEY=sua_chave_aqui
```

## Rodando localmente

```bash
npm run dev
```

O app sobe em `http://localhost:8080` (ou próxima porta disponível).

## Expondo para amigos via Cloudflare Tunnel

### Tunnel temporário (sem conta Cloudflare)

```bash
cloudflared tunnel --url http://localhost:8080
```

### Tunnel permanente com domínio próprio

```bash
# 1. Autenticar
cloudflared tunnel login

# 2. Criar tunnel
cloudflared tunnel create copa

# 3. Criar registro DNS (substitua pelo seu domínio)
cloudflared tunnel route dns copa copa.seudominio.com.br

# 4. Criar ~/.cloudflared/config.yml
# tunnel: <id-gerado>
# credentials-file: ~/.cloudflared/<id>.json
# ingress:
#   - hostname: copa.seudominio.com.br
#     service: http://localhost:8080
#   - service: http_status:404

# 5. Iniciar
cloudflared tunnel run copa
```

Adicione `copa.seudominio.com.br` à lista de hosts permitidos no Vite:

```typescript
// vite.config.ts
vite: {
  server: {
    allowedHosts: ["copa.seudominio.com.br"],
  },
},
```

## Mantendo o app ativo (PM2)

```bash
npm install -g pm2
pm2 start "npm run dev" --name copa-app
pm2 start "cloudflared tunnel run copa" --name copa-tunnel
pm2 save

# Auto-iniciar no boot
crontab -e
# Adicionar: @reboot /caminho/para/pm2 resurrect
```

## Pontuação

| Acerto | Pontos |
|---|---|
| Placar exato | 3 pts |
| Vencedor/visitante certo | 2 pts |
| Empate certo (placar errado) | 1 pt |
| Trivia diária | 1 pt |

## Painel Admin

Acesse `/admin` com as credenciais do `.env`:

- **Jogadores** — lista completa com scores e botão de remoção
- **Partidas** — todos os palpites agrupados por jogo com pontuação

## Estrutura do projeto

```
src/
├── lib/
│   ├── fixtures.ts      # 72 jogos da fase de grupos + 39 perguntas de trivia
│   ├── api.ts           # OpenFootball (resultados) + API-Football (ao vivo)
│   ├── db.ts            # SQLite: players, predictions, trivia_answers, sessions
│   ├── server-fns.ts    # TanStack Server Functions (auth + CRUD)
│   └── store.ts         # Tipos, scoring, sessão local
├── routes/
│   ├── index.tsx        # App principal (hoje, ranking, histórico)
│   └── admin.tsx        # Painel administrativo
└── components/ui/       # shadcn/ui components
```

## Dados e APIs

- **Fase de grupos**: hardcoded em `fixtures.ts` (72 jogos, horários em BRT)
- **Resultados**: buscados automaticamente do OpenFootball a cada 30 min (ou 5 min durante jogos ao vivo)
- **Fase eliminatória**: buscada do OpenFootball a cada hora (atualiza bracket e resultados)
- **Placar ao vivo**: API-Football, polling a cada 10 min (~9 req/jogo, dentro das 100 req/dia grátis)

## Licença

MIT
