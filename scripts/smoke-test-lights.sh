#!/usr/bin/env bash
# Lights smoke test: fire 7 rainbow colors directly at the Hue trigger API,
# then immediately restore the light to its original state.
set -euo pipefail

BASE="${STICKIES_BASE_URL:-http://localhost:4444}"
DELAY="${LIGHTS_DELAY:-1.2}"   # seconds between color changes (visible on hardware)
PASS=0
FAIL=0

# Rainbow: red orange yellow green blue indigo violet
RAINBOW=("#FF3B30" "#FF9500" "#FFCC00" "#34C759" "#007AFF" "#5856D6" "#AF52DE")
RAINBOW_NAMES=("Red" "Orange" "Yellow" "Green" "Blue" "Indigo" "Violet")

echo "=== Lights smoke test ==="
echo "Target : $BASE"
echo "Delay  : ${DELAY}s between colors"
echo ""

# ── 1. Fire 7 rainbow colors ─────────────────────────────────────────────────
for i in $(seq 1 7); do
  IDX=$((i - 1))
  COLOR="${RAINBOW[$IDX]}"
  COLOR_NAME="${RAINBOW_NAMES[$IDX]}"

  RESP=$(curl -sf -X POST "$BASE/api/hue/trigger" \
    -H "Content-Type: application/json" \
    -d "{\"color\": \"$COLOR\"}")

  OK=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null || echo "")
  VIA=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('via','?'))" 2>/dev/null || echo "?")
  REASON=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('reason',d.get('error','')))" 2>/dev/null || echo "")

  if [ "$OK" = "True" ]; then
    echo "  ✓ Light $i [$COLOR_NAME $COLOR] — via $VIA"
    PASS=$((PASS + 1))
  else
    echo "  ✗ Light $i [$COLOR_NAME $COLOR] — FAILED${REASON:+ ($REASON)}"
    FAIL=$((FAIL + 1))
  fi

  # Pause so the color is visible on hardware (skip after last)
  if [ "$i" -lt 7 ]; then
    sleep "$DELAY"
  fi
done

echo ""
echo "Fired $PASS / 7 colors"
echo ""

# ── 2. Restore light to original ────────────────────────────────────────────
echo "=== Restore ==="
RESTORE_RESP=$(curl -sf -X DELETE "$BASE/api/hue/trigger" 2>/dev/null || echo "{}")
RESTORE_OK=$(echo "$RESTORE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null || echo "")

if [ "$RESTORE_OK" = "True" ]; then
  echo "  ✓ Light restored to original"
else
  ERR=$(echo "$RESTORE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',d.get('reason','unknown')))" 2>/dev/null || echo "unknown")
  echo "  ✗ Restore failed: $ERR"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results ==="
echo "  TRIGGER: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "✅ All checks passed."
  exit 0
else
  echo "❌ $FAIL check(s) failed."
  exit 1
fi
