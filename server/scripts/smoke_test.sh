#!/usr/bin/env bash
set -euo pipefail

# Smoke/integration test for Climatus server cache behaviour
# - Starts the server in the background (dev mode using tsx)
# - Optionally forces an immediate collection cycle by invoking the dataCollectionService.collectData via a special HTTP endpoint exposed for testing
# - Waits for cache files to appear and then queries the API to assert X-Cache header and fetchedAt presence

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SERVER_DIR="$ROOT_DIR"
CACHE_DIR="$ROOT_DIR/server/data/cache"

PORT=${PORT:-12000}
ALLOW_LIVE=${SERVER_ALLOW_LIVE_FETCH_ON_MISS:-false}

echo "Starting smoke test (PORT=$PORT, SERVER_ALLOW_LIVE_FETCH_ON_MISS=$ALLOW_LIVE)"

# Start server in background (dev mode)
cd "$SERVER_DIR"
node --version >/dev/null 2>&1 || (echo "node required" && exit 1)

echo "Launching server..."
npm --prefix . run dev > /tmp/climatus-smoke-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

cleanup() {
  echo "Stopping server PID $SERVER_PID"
  kill $SERVER_PID || true
}
trap cleanup EXIT

echo "Waiting for server to be ready..."
for i in $(seq 1 30); do
  if curl -sS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "Server is up"
    break
  fi
  sleep 1
done

# Optionally request an immediate collection via the server's status endpoint if present
if [ "${1:-}" = "--force-collect" ]; then
  echo "Triggering immediate collection via /api/data-collection/trigger (if available)"
  curl -sS -X POST "http://localhost:$PORT/api/data-collection/trigger" || true
fi

echo "Waiting up to 30s for cache files to appear..."
for i in $(seq 1 30); do
  if [ -d "$CACHE_DIR" ] && [ "$(ls -A "$CACHE_DIR" 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "Found cache files"
    break
  fi
  sleep 1
done

echo "Checking API returns cached current weather for first accuracy location"
# Read first cached file and extract coords
FIRST_FILE=$(ls -1 "$CACHE_DIR"/*.current.json 2>/dev/null | head -n1 || true)
if [ -z "$FIRST_FILE" ]; then
  echo "No current cache files found in $CACHE_DIR"
  exit 2
fi

LAT=$(jq -r '.data.latitude // .data.location.latitude // empty' "$FIRST_FILE" || echo "")
LON=$(jq -r '.data.longitude // .data.location.longitude // empty' "$FIRST_FILE" || echo "")

if [ -z "$LAT" ] || [ -z "$LON" ]; then
  echo "Could not extract lat/lon from $FIRST_FILE -- falling back to querying by filename"
  # Try to parse from filename slug by consulting server/src/services/dataCollectionService.ts locations
  echo "Please run the collection manually or provide --force-collect"
  exit 3
fi

resp_headers=$(mktemp)
curl -sS -D "$resp_headers" -o /tmp/smoke_resp.json "http://localhost:$PORT/api/weather/current?latitude=$LAT&longitude=$LON"

echo "Response headers:"; cat "$resp_headers"

if grep -qi "x-cache: hit" "$resp_headers"; then
  echo "X-Cache: HIT as expected"
else
  echo "X-Cache header not HIT; contents:"; cat /tmp/smoke_resp.json
  exit 4
fi

if jq -e '.fetchedAt' /tmp/smoke_resp.json >/dev/null 2>&1; then
  echo "Response contains fetchedAt"
else
  echo "Response missing fetchedAt"; cat /tmp/smoke_resp.json; exit 5
fi

echo "Smoke test passed"
exit 0
