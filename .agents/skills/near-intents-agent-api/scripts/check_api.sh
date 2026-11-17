#!/usr/bin/env bash
# Read-only smoke test for a NEAR Intents Agent API key. Moves no funds, changes nothing.
#
#   NEAR_INTENTS_AGENT_API_KEY=naa_... ./check_api.sh
#   NEAR_INTENTS_AGENT_API_URL=https://api.agentsonintents.com NEAR_INTENTS_AGENT_API_KEY=naa_... ./check_api.sh
#
# Needs curl; uses jq for pretty output when installed.
set -euo pipefail

API_URL="${NEAR_INTENTS_AGENT_API_URL:-https://api.agentsonintents.com}"
API_URL="${API_URL%/}"

pretty() { if command -v jq >/dev/null 2>&1; then jq "$@"; else cat; fi; }
count() { if command -v jq >/dev/null 2>&1; then jq -r '.data | length'; else grep -o "\"$1\"" | wc -l | tr -d ' '; fi; }

call() {
  local path="$1" auth="${2:-}"
  local args=(-sS -w '\n%{http_code}' -H 'Accept: application/json')
  [[ -n "$auth" ]] && args+=(-H "X-API-Key: $auth")
  local out code
  out="$(curl "${args[@]}" "$API_URL$path")"
  code="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
  STATUS="$code"
}

echo "API: $API_URL"

call /v1/network
if [[ "$STATUS" != 200 ]]; then
  echo "✗ GET /v1/network → $STATUS (is the URL right?)"; echo "$BODY"; exit 1
fi
echo "✓ network"
echo "$BODY" | pretty '{network, contract_id, supported_owner_types, overall: .status.overall,
  components: [.status.components[] | {id, status, reason}]}'

call /v1/tokens
echo "✓ tokens: $(echo "$BODY" | count asset_id) assets"

if [[ -z "${NEAR_INTENTS_AGENT_API_KEY:-}" ]]; then
  echo "! NEAR_INTENTS_AGENT_API_KEY not set: skipped authenticated checks (create a key in the partner dashboard)"
  exit 0
fi
if [[ ! "$NEAR_INTENTS_AGENT_API_KEY" =~ ^naa_[A-Za-z0-9_-]{43}$ ]]; then
  echo "✗ NEAR_INTENTS_AGENT_API_KEY does not look like a naa_ key (check for quotes or whitespace)"; exit 1
fi

call /v1/whoami "$NEAR_INTENTS_AGENT_API_KEY"
if [[ "$STATUS" != 200 ]]; then
  echo "✗ GET /v1/whoami → $STATUS"; echo "$BODY" | pretty '.errors[0] | {code, detail}'; exit 1
fi
echo "✓ key valid"; echo "$BODY" | pretty .

call /v1/quotas "$NEAR_INTENTS_AGENT_API_KEY"
echo "✓ quotas"; echo "$BODY" | pretty '{limits, usage}'

call "/v1/agents" "$NEAR_INTENTS_AGENT_API_KEY"
echo "✓ agents on this tenant (first page): $(echo "$BODY" | count external_user_id)"
