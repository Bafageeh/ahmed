#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/home/pmsa/apps/ahmed}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
EXPO_PORT="${AHMED_EXPO_PORT:-8082}"
TARGET_SHA="${AHMED_TARGET_SHA:-}"
RUNTIME_BASE="/home/pmsa/apps"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"
LOG_FILE="$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.log"
PID_FILE="$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.pid"

log() { echo "[Ahmed Expo Fast Restart] $1"; }

if [ ! -d "$PROJECT_PATH/.git" ]; then
  echo "ERROR: $PROJECT_PATH is not a Git repository." >&2
  exit 1
fi

cd "$PROJECT_PATH"
log "Syncing latest main"
git fetch origin main

# The hot-deploy workflow passes the exact triggering commit. Respect it so
# overlapping pushes cannot silently deploy a newer or different revision.
if [ -n "$TARGET_SHA" ]; then
  if ! git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null; then
    log "Fetching exact target commit $TARGET_SHA"
    git fetch origin "$TARGET_SHA"
  fi
  log "Resetting to exact target commit $TARGET_SHA"
  git reset --hard "$TARGET_SHA"
else
  log "No target SHA supplied; resetting to origin/main"
  git reset --hard origin/main
fi

log "Applying the same source patches used by Android APK"
# Repair AppShell navigation first. This makes the older quick-menu patch
# idempotent even when AppShell formatting or previous patches have changed.
python3 scripts/patch-ta3meed-navigation-callbacks.py
python3 scripts/patch-ta3meed-quick-menu.py
python3 scripts/patch-credit-card-no-cents.py
python3 scripts/patch-tokenize-platform.py

# Verify the compact credit-card UI is committed directly in source.
grep -q "creditCardSummary={creditCardSummary}" "$MOBILE_DIR/DebtsScreen.js" || {
  echo "ERROR: Credit-card summary wiring is missing from DebtsScreen.js" >&2
  exit 1
}
if grep -q "creditCardsButton" "$MOBILE_DIR/DebtsScreen.js"; then
  echo "ERROR: Old floating credit-card button is still present in DebtsScreen.js" >&2
  exit 1
fi
grep -q "BankLogo bankName={item.bank_name} size={29}" "$MOBILE_DIR/CreditCardDebtsScreen.js" || {
  echo "ERROR: Bank logo is missing from compact credit-card source" >&2
  exit 1
}
grep -q "cardBottomRow" "$MOBILE_DIR/CreditCardDebtsScreen.js" || {
  echo "ERROR: Compact credit-card cardBottomRow is missing" >&2
  exit 1
}
grep -q "SAUDI_BANKS" "$MOBILE_DIR/CreditCardDebtsScreen.js" || {
  echo "ERROR: Saudi bank dropdown source is missing" >&2
  exit 1
}
grep -q "اختصارات تعميد" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js" || {
  echo "ERROR: Ta3meed floating quick menu is missing" >&2
  exit 1
}
grep -q "onOpenInvestorAccounts" "$MOBILE_DIR/AppShell.js" || {
  echo "ERROR: Ta3meed quick-menu navigation callbacks are missing" >&2
  exit 1
}
grep -q "minimumFractionDigits: 0" "$MOBILE_DIR/CreditCardDebtsScreen.js" || {
  echo "ERROR: Credit-card no-halalas display patch is missing" >&2
  exit 1
}
grep -q "TokenizeInvestmentsScreen" "$MOBILE_DIR/AppShell.js" || {
  echo "ERROR: Tokenize platform is not wired into AppShell.js" >&2
  exit 1
}
TOKENIZE_IMPORT_COUNT="$(grep -Fc "import TokenizeInvestmentsScreen from './TokenizeInvestmentsScreen';" "$MOBILE_DIR/AppShell.js")"
TOKENIZE_NAV_COUNT="$(grep -Fc "if (investmentScreen === 'tokenize')" "$MOBILE_DIR/AppShell.js")"
if [ "$TOKENIZE_IMPORT_COUNT" -ne 1 ] || [ "$TOKENIZE_NAV_COUNT" -ne 1 ]; then
  echo "ERROR: Duplicate Tokenize wiring detected (imports=$TOKENIZE_IMPORT_COUNT, nav=$TOKENIZE_NAV_COUNT)" >&2
  exit 1
fi
grep -q "Route::get('/tokenize/investments'" "$PROJECT_PATH/ahmed-api/routes/api.php" || {
  echo "ERROR: Tokenize API routes are missing" >&2
  exit 1
}
if grep -q "babel-plugin-credit-card-bank-logos" "$MOBILE_DIR/babel.config.js"; then
  echo "ERROR: Faulty credit-card bank-logo Babel plugin is still enabled" >&2
  exit 1
fi

cd "$MOBILE_DIR"
echo "EXPO_PUBLIC_API_URL=https://$DOMAIN/api" > .env

if [ ! -d node_modules ] || [ ! -d node_modules/expo-updates ]; then
  log "Installing mobile dependencies"
  npm install --legacy-peer-deps --no-audit --no-fund
fi

log "Clearing Metro/Expo caches"
rm -rf .expo .expo-shared node_modules/.cache .metro-cache
rm -rf "$RUNTIME_BASE/.cache/expo" "$RUNTIME_BASE/.cache/metro" "$RUNTIME_BASE/.cache/react-native" 2>/dev/null || true
mkdir -p "$RUNTIME_BASE/.cache" "$RUNTIME_BASE/.tmp"

log "Stopping Expo/Metro on port $EXPO_PORT"
if command -v lsof >/dev/null 2>&1; then
  lsof -tiTCP:"$EXPO_PORT" -sTCP:LISTEN | xargs -r kill -9 || true
fi
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${EXPO_PORT}/tcp" 2>/dev/null || true
fi
pkill -f "expo.*--port $EXPO_PORT" || true
pkill -f "metro.*$EXPO_PORT" || true
sleep 2

log "Starting Expo on port $EXPO_PORT"
: > "$LOG_FILE"
export BROWSER=none
export CI=1
export EXPO_NO_TELEMETRY=1
export EXPO_NO_DEVTOOLS=1
export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
export XDG_CACHE_HOME="$RUNTIME_BASE/.cache"
export TMPDIR="$RUNTIME_BASE/.tmp"
export TMP="$RUNTIME_BASE/.tmp"
export TEMP="$RUNTIME_BASE/.tmp"

nohup npx expo start --clear --go --host lan --port "$EXPO_PORT" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 12
PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "ERROR: Expo process exited during startup." >&2
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

if command -v ss >/dev/null 2>&1; then
  if ! ss -ltn | grep -q ":$EXPO_PORT "; then
    echo "ERROR: Expo process is alive but port $EXPO_PORT is not listening." >&2
    tail -n 120 "$LOG_FILE" || true
    exit 1
  fi
fi

log "Expo restarted successfully"
log "Commit: $(git rev-parse HEAD)"
log "PID: $PID"
log "URL: exp://$DOMAIN:$EXPO_PORT"
tail -n 60 "$LOG_FILE" || true

# Expo and APK share the Ta3meed, credit-card, and idempotent Tokenize source patch scripts.
