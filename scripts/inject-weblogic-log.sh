#!/usr/bin/env bash
set -euo pipefail

# Push a WebLogic log file into Agentci Live Log Injection Agent.
# Usage:
#   STREAM_INGEST_TOKEN=... STREAM_ID=... ./scripts/inject-weblogic-log.sh /path/to/AdminServer.log
# Optional:
#   AGENTCI_BASE_URL=http://127.0.0.1:3000

LOG_FILE="${1:-}"
BASE_URL="${AGENTCI_BASE_URL:-http://127.0.0.1:3000}"
TOKEN="${STREAM_INGEST_TOKEN:-}"
STREAM_ID="${STREAM_ID:-}"

if [[ -z "$LOG_FILE" || ! -f "$LOG_FILE" ]]; then
  echo "Usage: STREAM_ID=... STREAM_INGEST_TOKEN=... $0 /path/to/server.log" >&2
  exit 1
fi

if [[ -z "$TOKEN" || -z "$STREAM_ID" ]]; then
  echo "STREAM_ID and STREAM_INGEST_TOKEN are required." >&2
  exit 1
fi

echo "Tailing $LOG_FILE -> $BASE_URL (stream $STREAM_ID)"

tail -n 0 -F "$LOG_FILE" | while IFS= read -r line || [[ -n "$line" ]]; do
  payload=$(LINE="$line" STREAM_ID="$STREAM_ID" python3 -c 'import json,os; print(json.dumps({"streamId": os.environ["STREAM_ID"], "lines": [os.environ.get("LINE","")], "flush": False}))')
  curl -sS -X POST "$BASE_URL/api/live-logs/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null
done
