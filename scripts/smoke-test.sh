#!/usr/bin/env bash
# Smoke test: POST 7 "light rain" notes to /api/stickies/local, then DELETE all of them.
set -euo pipefail

BASE="${STICKIES_BASE_URL:-http://localhost:4444}"
API_KEY="${STICKIES_API_KEY:-sk_stickies_d218dfa0abe37b82c5269f40bd478ddca7b567bbd1310efc}"
FOLDER="SMOKE_TEST"
PASS=0
FAIL=0
CREATED_IDS=()

# Rainbow: red orange yellow green blue indigo violet
RAINBOW=("#FF3B30" "#FF9500" "#FFCC00" "#34C759" "#007AFF" "#5856D6" "#AF52DE")
RAINBOW_NAMES=("Red" "Orange" "Yellow" "Green" "Blue" "Indigo" "Violet")

echo "=== Stickies smoke test ==="
echo "Target: $BASE"
echo ""

# ── 1. POST 7 notes ──────────────────────────────────────────────────────────
for i in $(seq 1 7); do
  IDX=$((i - 1))
  COLOR="${RAINBOW[$IDX]}"
  COLOR_NAME="${RAINBOW_NAMES[$IDX]}"
  TITLE="Light Rain #$i — $COLOR_NAME"
  BODY=$(printf '{"title":"%s","content":"🌧 Smoke test note %d — safe to delete","folder":"%s"}' "$TITLE" "$i" "$FOLDER")

  RESP=$(curl -sf -X POST "$BASE/api/stickies/local?color=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$COLOR'))")" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY")

  ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['note']['id'])" 2>/dev/null || echo "")

  if [ -n "$ID" ]; then
    echo "  ✓ POST note $i [$COLOR_NAME $COLOR] — id: $ID"
    CREATED_IDS+=("$ID")
    PASS=$((PASS + 1))
  else
    echo "  ✗ POST note $i — FAILED (response: $RESP)"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Created ${#CREATED_IDS[@]} / 7 notes"
echo ""

# ── 2. DELETE all created notes via Supabase REST ────────────────────────────
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  # Try loading from .env.local next to this script
  ENV_FILE="$(dirname "$0")/../.env.local"
  if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
    SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
    SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
  fi
fi

echo "=== Cleanup ==="
DEL_PASS=0
DEL_FAIL=0

for ID in "${CREATED_IDS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "$SUPABASE_URL/rest/v1/notes?id=eq.$ID" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY")

  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    echo "  ✓ DELETE $ID"
    DEL_PASS=$((DEL_PASS + 1))
  else
    echo "  ✗ DELETE $ID — HTTP $STATUS"
    DEL_FAIL=$((DEL_FAIL + 1))
  fi
done

echo ""
echo "=== Results ==="
echo "  POST  : $PASS passed, $FAIL failed"
echo "  DELETE: $DEL_PASS passed, $DEL_FAIL failed"
echo ""

TOTAL_FAIL=$((FAIL + DEL_FAIL))
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo "✅ All checks passed."
  exit 0
else
  echo "❌ $TOTAL_FAIL check(s) failed."
  exit 1
fi
