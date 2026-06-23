# Browser QA Checklist

Manual end-to-end checks for PairLink. Run each scenario in **Chrome**, **Firefox**, and **Safari** (desktop). Add **iOS Safari** when HTTPS is available.

## Prerequisites

- PairLink running (`make dev` or `docker compose up`)
- Two browser profiles or two devices on the same network
- For cross-network / TURN tests: configure `RTC_CONFIG` with your coturn server (see `deploy/coturn/turnserver.conf`)

## Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Same network — create room and join | WebRTC connection established; connection badge shows WebRTC |
| 2 | Send a ~10 MB file | Progress bar updates; downloaded file matches original size and content |
| 3 | Interrupt transfer (disable Wi‑Fi ~3 s, then re-enable) | Status shows interrupted; Resume continues from last acked offset |
| 4 | Send Markdown message (headings, list, fenced code block) | Renders correctly; no script execution (XSS) |
| 5 | Masked message | Content hidden by default; reveal shows rendered Markdown |
| 6 | Theme toggle (light / dark / system) | UI remains readable; no layout breakage |
| 7 | Cross-network (strict NAT, TURN configured) | ICE completes or falls back to encrypted WebSocket relay |
| 8 | iOS Safari (HTTPS) | Can join session; reconnects after brief background |

## Notes

- Safari may throttle background tabs; keep the session tab foreground during large transfers.
- Chunk size stays ≤ 64 KB for Safari compatibility.
- File pickers require a user gesture (click) — drag-and-drop and button upload both count.

## Reporting

File bugs with browser version, OS, network topology (same LAN / cross-NAT), and whether the path was WebRTC or relay.
