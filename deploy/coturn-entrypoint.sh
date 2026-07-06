#!/bin/sh
set -e

. /usr/local/bin/runtime-env.sh

if [ "${TURN_ENABLED:-false}" != "true" ]; then
  echo "coturn: TURN_ENABLED is not true, skipping TURN server"
  TURN_ENABLED=false
  write_runtime_env
  exit 0
fi

TURN_USER="${TURN_USER:-pairlink}"
TURN_REALM="${TURN_REALM:-pairlink}"
TURN_PORT="${TURN_PORT:-3478}"

if [ -z "${TURN_PASSWORD:-}" ]; then
  TURN_PASSWORD="$(random_secret)"
  echo "coturn: generated TURN_PASSWORD at container start"
fi

write_runtime_env

set -- turnserver -n \
  --log-file=stdout \
  --listening-port="$TURN_PORT" \
  --fingerprint \
  --lt-cred-mech \
  --realm="$TURN_REALM" \
  --user="${TURN_USER}:${TURN_PASSWORD}" \
  --no-cli \
  --no-multicast-peers

if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
  set -- "$@" --external-ip="$TURN_EXTERNAL_IP" --relay-ip="$TURN_EXTERNAL_IP"
fi

echo "coturn: starting on port $TURN_PORT (realm=$TURN_REALM user=$TURN_USER)"
exec "$@"
