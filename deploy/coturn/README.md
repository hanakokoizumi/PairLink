# Coturn (TURN)

PairLink starts coturn automatically with `docker compose up`. Credentials are generated at **container start** — no manual config file and no `make setup` step.

## Flow

1. **coturn** starts first; if `TURN_PASSWORD` is empty, it generates one and writes `/data/runtime.env`
2. **pairlink** reads the same file and exposes matching TURN credentials in `/api/config`

## Variables

| Variable | Description |
|----------|-------------|
| `TURN_ENABLED` | `true` to start coturn and expose TURN in API config |
| `TURN_HOST` | Hostname clients use (default: host from `PUBLIC_URL`) |
| `TURN_PORT` | Listening port (default `3478`) |
| `TURN_USER` / `TURN_PASSWORD` | Long-term credentials (password auto-generated on first start if empty) |
| `TURN_REALM` | coturn realm (default `pairlink`) |
| `TURN_EXTERNAL_IP` | Public IP for NAT traversal (optional) |

Set `TURN_ENABLED=false` to disable the bundled TURN server.
