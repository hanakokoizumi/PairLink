#!/bin/sh
set -e

if [ "${TURN_ENABLED:-false}" != "true" ]; then
  echo "coturn: TURN_ENABLED is not true, skipping TURN server"
  exit 0
fi

if [ -z "${TURN_PASSWORD:-}" ]; then
  echo "coturn: TURN_PASSWORD is required when TURN_ENABLED=true (run: make setup)" >&2
  exit 1
fi

TURN_PORT="${TURN_PORT:-3478}"
TURN_REALM="${TURN_REALM:-pairlink}"
TURN_USER="${TURN_USER:-pairlink}"

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
