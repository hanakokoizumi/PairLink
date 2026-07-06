# Shared helpers for Docker runtime credential setup (sourced by entrypoints).
RUNTIME_ENV="${PAIRLINK_RUNTIME_ENV:-/data/runtime.env}"

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '/+=' | head -c 32
  else
    head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32
  fi
}

write_runtime_env() {
  mkdir -p "$(dirname "$RUNTIME_ENV")"
  umask 177
  {
    printf 'TURN_ENABLED=%s\n' "${TURN_ENABLED:-false}"
    printf 'TURN_USER=%s\n' "${TURN_USER:-pairlink}"
    printf 'TURN_PASSWORD=%s\n' "${TURN_PASSWORD:-}"
  } > "$RUNTIME_ENV"
}

load_runtime_env() {
  if [ ! -f "$RUNTIME_ENV" ]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV"
  set +a
  return 0
}

wait_for_runtime_env() {
  i=0
  while [ "$i" -lt 30 ]; do
    if [ -f "$RUNTIME_ENV" ]; then
      if grep -q '^TURN_ENABLED=false' "$RUNTIME_ENV" 2>/dev/null; then
        load_runtime_env
        return 0
      fi
      if grep -q '^TURN_PASSWORD=.' "$RUNTIME_ENV" 2>/dev/null; then
        load_runtime_env
        return 0
      fi
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}
