#!/usr/bin/env bash
# Token-free, change-gated test runner.
#
# Runs the unit/integration suite (npx vitest run) ONLY when a source file
# actually changes — no Claude, no model turns, zero tokens. This replaces the
# blind every-10-min loop: if nothing changed, nothing runs.
#
#   Usage:  bash scripts/test-on-change.sh
#   Log:    tail -f /tmp/stickies-test-on-change.log
#   Detail: /tmp/stickies-vitest-last.log   (full output of the most recent run)
#   Stop:   Ctrl-C, or kill the background job.
#
# Watches app/ components/ lib/ tests/ for *.ts / *.tsx / *.css saves via mtime
# fingerprint. Polls every 20s. Playwright (slow, ~4min) stays manual on purpose.

set -u
cd "$(dirname "$0")/.." || exit 1

LOG=/tmp/stickies-test-on-change.log
DETAIL=/tmp/stickies-vitest-last.log
INTERVAL="${1:-20}"

fingerprint() {
  find app components lib tests -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
    -exec stat -f '%m %N' {} + 2>/dev/null | shasum | cut -d' ' -f1
}

stamp() { date '+%Y-%m-%d %H:%M:%S'; }

last="$(fingerprint)"
echo "[$(stamp)] watcher started — baseline captured, idle until a source file changes" >> "$LOG"

while true; do
  sleep "$INTERVAL"
  cur="$(fingerprint)"
  [ "$cur" = "$last" ] && continue          # nothing changed → do nothing, no tokens
  last="$cur"
  echo "[$(stamp)] change detected — running vitest…" >> "$LOG"
  if npx vitest run > "$DETAIL" 2>&1; then
    summary="$(grep -E '^[[:space:]]*Tests[[:space:]]' "$DETAIL" | tail -1 | sed 's/^[[:space:]]*//')"
    echo "[$(stamp)] PASS — ${summary:-all tests passed}" >> "$LOG"
  else
    summary="$(grep -E '^[[:space:]]*Tests[[:space:]]' "$DETAIL" | tail -1 | sed 's/^[[:space:]]*//')"
    echo "[$(stamp)] FAIL — ${summary:-see $DETAIL}" >> "$LOG"
    osascript -e 'display notification "Stickies vitest FAILED" with title "test-on-change"' 2>/dev/null || true
  fi
done
