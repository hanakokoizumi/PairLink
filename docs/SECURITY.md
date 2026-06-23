# Security

Threat model and mitigations for PairLink. For vulnerability reports, use [GitHub Security Advisories](https://github.com/hanakokoizumi/PairLink/security/advisories/new).

## Scope

PairLink is a self-hosted signaling and optional relay server. **File and message payloads are end-to-end encrypted** between browsers on the relay path; WebRTC uses browser-native DTLS-SRTP. The server stores no user database and no transfer content.

## Threat matrix

| Threat | Mitigation |
|--------|------------|
| Man-in-the-middle on relay path | ECDH key agreement + AES-GCM; server forwards ciphertext only |
| Man-in-the-middle on WebRTC path | DTLS-SRTP (browser stack); document TLS for HTTPS deployment |
| Server reading file or message content | Relay forwards opaque chunks; WebRTC media does not traverse the server |
| XSS via Markdown messages | `rehype-sanitize`; raw HTML disabled |
| Brute-forcing room codes | 5-digit codes, TTL (default 30 min), `JOIN_RATE_LIMIT` |
| Brute-forcing login | bcrypt password hashes, `LOGIN_RATE_LIMIT`, uniform error responses |
| CSRF on OIDC callback | `state` and `nonce` validation |
| Clickjacking | `X-Frame-Options: DENY` (when `SECURITY_HEADERS=true`) |
| Room code enumeration | `crypto/rand` generation; rate limits on lookup |

## Deployment hardening

Production deployments should set:

| Setting | Why |
|---------|-----|
| `JWT_SECRET` | Stable sessions across restarts (avoid ephemeral secret) |
| `PUBLIC_URL` | HTTPS origin for links, QR codes, CORS, OIDC redirects |
| `PAIRLINK_USERS` or OIDC | Restrict who can create rooms |
| TURN (`RTC_CONFIG`) | Reliable connectivity behind symmetric NAT |
| Reverse proxy TLS | Terminate HTTPS at nginx, Caddy, or similar |

## Out of scope

- Compromised client devices or browser extensions
- Physical access to a peer's machine
- Denial-of-service at the network edge (use upstream rate limiting / WAF)

## Responsible disclosure

Please report security issues privately via GitHub Security Advisories before public disclosure. We aim to acknowledge reports within 72 hours.
