#!/bin/sh
set -e

API_PORT="${PAIRLINK_API_PORT:-8081}"
if [ "$API_PORT" != "8081" ]; then
  echo "pairlink: PAIRLINK_API_PORT must be 8081 for the prebuilt image (or rebuild with matching INTERNAL_API_URL)" >&2
  exit 1
fi

PORT="$API_PORT" /app/pairlink &
GO_PID=$!

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PAIRLINK_WEB_PORT:-8080}"
cd /app/web
node server.js &
WEB_PID=$!

cleanup() {
  kill -TERM "$GO_PID" "$WEB_PID" 2>/dev/null
  wait "$GO_PID" 2>/dev/null
  wait "$WEB_PID" 2>/dev/null
}
trap cleanup TERM INT

set +e
while kill -0 "$GO_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done
cleanup
exit 1
