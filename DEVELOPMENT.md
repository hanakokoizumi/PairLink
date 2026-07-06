# Development

Guide for running, testing, and debugging PairLink locally.

## Prerequisites

Install on your machine (use whatever versions you already have):

| Tool | Notes |
|------|--------|
| **Go** | See `server/go.mod` for the module version |
| **Node.js** | LTS or current; Docker image pins `20-alpine` |
| **pnpm** | `corepack enable && corepack prepare pnpm@9 --activate` |
| **Docker** | Optional — for container builds and `docker compose` |

<details>
<summary>Verified reference environment (optional)</summary>

| Tool | Version |
|------|---------|
| Go | 1.26.4 |
| Node.js | 22.x |
| pnpm | 9.x via Corepack |
| Docker Compose | v2+ |

</details>

## First-time setup

```bash
git clone https://github.com/hanakokoizumi/PairLink.git
cd PairLink

cd web && pnpm install && cd ..
```

Optional: copy environment defaults when you need overrides.

```bash
make setup   # cp -n .env.example .env
```

## Run locally (recommended)

```bash
make dev
```

This starts **two processes** in parallel:

| Process | Command | Port | Role |
|---------|---------|------|------|
| Go API | `go run ./cmd/pairlink` | **8080** | REST, WebSocket (`/ws`), health |
| Next.js | `pnpm dev` | **3000** | Frontend UI |

Open **http://localhost:3000** in the browser.

Next.js rewrites `/api/*`, `/ws`, and `/health` to `http://localhost:8080` (see `web/next.config.ts`). You do **not** need `NEXT_PUBLIC_API_URL` during `make dev`.

**Zero-config defaults:** with no `PAIRLINK_USERS` and OIDC off, the server auto-enables `DISABLE_AUTH` so you can create rooms without logging in.

### Manual two-terminal workflow

```bash
# Terminal 1
make dev-server

# Terminal 2
make dev-web
```

- **Go:** restart `dev-server` after code changes (no hot reload).
- **Web:** Next.js hot-reloads on save.

## Typical debug flow

1. **Host:** home page → start connection → note the 5-digit code or share URL.
2. **Guest:** second browser or private window → enter code or open `/r/{code}` / session URL.
3. **Transfer:** when both peers are online, files and Markdown messages use WebRTC; if ICE fails, encrypted WebSocket relay (`WS_FALLBACK`) takes over.

For WebRTC issues, use **two different browsers** (e.g. Chrome + Firefox) and watch DevTools → **Network** (WS) and **Console**.

## Configuration (development)

Root `.env` is loaded when `PAIRLINK_LOAD_DOTENV=true` (default in `.env.example`). Common overrides:

```bash
LOG_LEVEL=debug
PUBLIC_URL=http://localhost:8080
```

### Local password auth

```bash
make hash-password PASSWORD=secret
# Add output to PAIRLINK_USERS in .env, e.g.:
# PAIRLINK_USERS=admin:bcrypt|$2a$...
```

### OIDC during `make dev`

The Next.js dev server runs on port **3000**, so set:

```bash
OIDC_REDIRECT_URL=http://localhost:3000/api/auth/oidc/callback
```

For Docker / single-port deploys, use port **8080** instead (see `.env.example` comments).

## Test, lint, and build

```bash
make test      # Go (race) + Vitest
make lint      # golangci-lint (if installed) + ESLint
make build     # pnpm build + bin/pairlink
```

Run a single side:

```bash
make test-server
make test-web
cd web && pnpm test        # Vitest watch mode
```

## Docker (production-like)

```bash
make docker-up    # docker compose up -d --build
```

Open **http://localhost:8080** (single port; Go + Next run inside the container).

Optional TURN for strict NAT (bundled coturn, credentials generated at container start):

```bash
docker compose up -d --build
```

Set `TURN_ENABLED=false` in `.env` to disable. See `deploy/coturn/README.md`.

## Debugging tips

### Go server

- Set `LOG_LEVEL=debug` for room, WebSocket, and auth logs.
- `curl http://localhost:8080/health`
- `curl http://localhost:8080/api/config`
- Delve: `cd server && dlv debug ./cmd/pairlink`

### Frontend

- Browser DevTools: Network (`/api`, `/ws`), Console, Application → IndexedDB (resume store).
- Unit tests: `cd web && pnpm test`
- Copy: `web/messages/*.json`

### WebRTC / transfers

- Strict NAT often needs TURN in `RTC_CONFIG` (see `deploy/coturn/` and README Configuration).
- Manual QA checklist: [docs/browser-qa.md](docs/browser-qa.md)

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Page loads on :3000 but API fails | Go server not running on :8080 — check `make dev-server` |
| Peers never connect | Same browser only; try two browsers or configure TURN |
| OIDC login OK but UI still asks for password | `OIDC_REDIRECT_URL` should use `:3000` under `make dev` |
| `pnpm dev` errors | Run `pnpm install` in `web/` |
| Relay works, WebRTC does not | Expected behind symmetric NAT without TURN — add ICE servers |

## Related docs

| Doc | Description |
|-----|-------------|
| [README.md](README.md) | Overview, deployment, configuration summary |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model |
| [docs/browser-qa.md](docs/browser-qa.md) | Cross-browser QA |
| [.env.example](.env.example) | Full environment variable list |
