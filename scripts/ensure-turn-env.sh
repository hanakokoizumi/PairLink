#!/bin/sh
# Ensures TURN credentials exist in .env when TURN is enabled (no manual coturn config).
set -e

ENV_FILE="${1:-.env}"
EXAMPLE_FILE="${2:-.env.example}"

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "ensure-turn-env: created $ENV_FILE from $EXAMPLE_FILE"
fi

turn_enabled() {
  val="$(grep -E '^TURN_ENABLED=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | tr 'A-Z' 'a-z')"
  case "$val" in
    true|1|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

get_env_val() {
  key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
}

set_env_val() {
  key="$1"
  value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" k "=" { print k "=" v; done = 1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

if ! turn_enabled; then
  exit 0
fi

password="$(get_env_val TURN_PASSWORD)"
if [ -n "$password" ]; then
  exit 0
fi

if command -v openssl >/dev/null 2>&1; then
  password="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
else
  password="$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)"
fi

set_env_val TURN_PASSWORD "$password"
echo "ensure-turn-env: generated TURN_PASSWORD in $ENV_FILE"

user="$(get_env_val TURN_USER)"
if [ -z "$user" ]; then
  set_env_val TURN_USER "pairlink"
fi
