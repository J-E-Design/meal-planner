#!/usr/bin/env bash
# Run every check: unit tests, colour contrast, and the browser tests in headless Chrome.
#   bash tests/run.sh            all checks
#   bash tests/run.sh unit       just the fast ones (no browser)
# The browser tests use a fake server and made-up data - they never touch your real data.
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
FAIL=0

echo "== Unit checks"; node tests/unit.js | tail -n 1 || FAIL=1
node tests/unit.js >/dev/null || FAIL=1
echo "== Colour contrast"; node tests/contrast.js || FAIL=1
for f in api/*.php; do php -l "$f" >/dev/null || { echo "PHP syntax error in $f"; FAIL=1; }; done
for f in js/*.js; do node --check "$f" || FAIL=1; done
[ "${1:-}" = "unit" ] && exit $FAIL

# Find Chrome / Edge / Chromium
CHROME=""
for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
done
[ -z "$CHROME" ] && { echo "No Chrome found - skipping browser tests"; exit $FAIL; }

# Build a test copy of the app with the fake server + cases loaded before the app's scripts
TMP="$ROOT/tests/.tmp"
rm -rf "$TMP"; mkdir -p "$TMP/looks"
cp index.html styles.css manifest.json icon.svg icon-192.png "$TMP/"
cp -r js "$TMP/"
cp looks/*.css "$TMP/looks/"
cp tests/fixture.js tests/harness.js "$TMP/"
sed -i 's#<script src="js/01-core.js"></script>#<script src="fixture.js"></script>\n<script src="harness.js"></script>\n<script src="js/01-core.js"></script>#' "$TMP/index.html"
grep -q 'src="harness.js"' "$TMP/index.html" || { echo "Couldn't add the test harness to index.html"; exit 1; }

CASES="loads shuffle_no_duplicates shuffle_keeps_locked next_week notes shopping_aisles_and_quantities ticks_offline_then_sync extras_and_finish_shop move_item_aisle veto rating swipe_and_match search_meals delete_meal_undo import_recipe backup_restore lock_screen escape_closes_dialog"
echo "== Browser tests"
run_case() { # look case [extra-query]
  local dir; dir="$(mktemp -d)"
  local page="$TMP/index.html" udd="$dir"
  if command -v cygpath >/dev/null 2>&1; then page="$(cygpath -m "$page")"; udd="$(cygpath -w "$dir")"; fi
  local url="file:///${page#/}?look=$1&case=$2${3:-}"
  local out
  out="$(timeout 60 "$CHROME" --headless=new --disable-gpu --user-data-dir="$udd" --virtual-time-budget=20000 --dump-dom "$url" 2>/dev/null \
        | grep -o '<pre id="result">.*</pre>' | sed 's/<[^>]*>//g;s/&quot;/"/g;s/&amp;/\&/g')"
  rm -rf "$dir"
  if echo "$out" | grep -q '"pass":true'; then printf "  ok    %-8s %s\n" "$1" "$2"
  else printf "  FAIL  %-8s %s  %s\n" "$1" "$2" "${out:-no result (page crashed or timed out)}"; FAIL=1; fi
}
for c in $CASES; do
  extra=""; [ "$c" = "lock_screen" ] && extra="&locked=1"
  run_case fridge "$c" "$extra"
done
# Smoke-test the other looks
for look in classic chalk calm; do run_case "$look" loads; run_case "$look" shuffle_keeps_locked; done

rm -rf "$TMP"
[ $FAIL -eq 0 ] && echo "All checks passed" || echo "SOME CHECKS FAILED"
exit $FAIL
