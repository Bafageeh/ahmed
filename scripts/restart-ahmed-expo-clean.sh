#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/home/pmsa/apps/ahmed}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
EXPO_PORT="${AHMED_EXPO_PORT:-8082}"
RUNTIME_BASE="/home/pmsa/apps"
API_DIR="$PROJECT_PATH/ahmed-api"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"
WEB_EXPORT_DIR="$MOBILE_DIR/dist-web"
WEB_PUBLIC_DIR="$API_DIR/public/webapp"
LOG_FILE="$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.log"

log() { echo "[Ahmed Expo Clean Restart] $1"; }

if [ ! -d "$PROJECT_PATH/.git" ]; then
  echo "ERROR: $PROJECT_PATH is not a Git repository." >&2
  exit 1
fi

log "Using project: $PROJECT_PATH"
cd "$PROJECT_PATH"

log "Fetching latest main"
git fetch origin main
git reset --hard origin/main

if [ -d "$API_DIR" ]; then
  log "Updating Laravel database and caches"
  cd "$API_DIR"
  php artisan optimize:clear || true
  php artisan migrate --force
  cd "$PROJECT_PATH"
fi

log "Applying Ta3meed local normalization patch"
python3 scripts/fix-ta3meed-screen-normalization.py

log "Verifying Ta3meed normalized screen"
if grep -n "resetButtonText" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js" | grep -q "hasFilters"; then
  echo "ERROR: Ta3meed reset filter button still exists." >&2
  exit 1
fi
grep -n "aValue === null && bValue !== null" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js" >/dev/null || {
  echo "ERROR: Ta3meed maturity sort was not applied." >&2
  exit 1
}

grep -n "import Ta3meedScreen from './Ta3meedNoResetFilterScreen'" "$MOBILE_DIR/AppShell.js" >/dev/null || {
  echo "ERROR: AppShell does not point to Ta3meedNoResetFilterScreen.js" >&2
  exit 1
}

cd "$MOBILE_DIR"
log "Writing mobile environment"
echo "EXPO_PUBLIC_API_URL=https://$DOMAIN/api" > .env

if [ -d "$API_DIR/public" ]; then
  log "Building Expo web app from mobile source"
  rm -rf "$WEB_EXPORT_DIR"
  npm install --legacy-peer-deps
  EXPO_BASE_URL=/webapp npx expo export --platform web --output-dir "$WEB_EXPORT_DIR"

  if [ ! -f "$WEB_EXPORT_DIR/index.html" ]; then
    echo "ERROR: Expo web export completed but index.html was not created." >&2
    exit 1
  fi

  log "Publishing Expo web app to Laravel public/webapp"
  rm -rf "$WEB_PUBLIC_DIR"
  mkdir -p "$WEB_PUBLIC_DIR"
  cp -a "$WEB_EXPORT_DIR/." "$WEB_PUBLIC_DIR/"

  WEB_PUBLIC_DIR="$WEB_PUBLIC_DIR" python3 - <<'PY'
import os
from pathlib import Path
p = Path(os.environ['WEB_PUBLIC_DIR']) / 'index.html'
s = p.read_text(encoding='utf-8')
s = s.replace('href="/_expo/', 'href="/webapp/_expo/')
s = s.replace('src="/_expo/', 'src="/webapp/_expo/')
s = s.replace('href="/assets/', 'href="/webapp/assets/')
s = s.replace('src="/assets/', 'src="/webapp/assets/')
p.write_text(s, encoding='utf-8')
PY

  log "Web app URL: https://$DOMAIN/webapp/"
fi

log "Clearing Expo and Metro caches"
rm -rf .expo .expo-shared node_modules/.cache .metro-cache
rm -rf "$RUNTIME_BASE/.cache/expo" "$RUNTIME_BASE/.cache/metro" "$RUNTIME_BASE/.cache/react-native"
mkdir -p "$RUNTIME_BASE/.cache" "$RUNTIME_BASE/.tmp"

log "Stopping old Expo/Metro processes on port $EXPO_PORT"
if command -v lsof >/dev/null 2>&1; then
  lsof -tiTCP:"$EXPO_PORT" -sTCP:LISTEN | xargs -r kill -9 || true
fi
pkill -f "expo.*--port $EXPO_PORT" || true
pkill -f "metro.*$EXPO_PORT" || true
pkill -f "React Native DevTools" || true

log "Starting Expo clean on port $EXPO_PORT"
touch "$LOG_FILE"
: > "$LOG_FILE"

export BROWSER=none
export CI=1
export EXPO_NO_TELEMETRY=1
export EXPO_NO_DEVTOOLS=1
export ELECTRON_DISABLE_SANDBOX=1
export REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN"
export XDG_CACHE_HOME="$RUNTIME_BASE/.cache"
export TMPDIR="$RUNTIME_BASE/.tmp"
export TMP="$RUNTIME_BASE/.tmp"
export TEMP="$RUNTIME_BASE/.tmp"

nohup npx expo start --clear --go --host lan --port "$EXPO_PORT" > "$LOG_FILE" 2>&1 &
echo $! > "$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.pid"

sleep 10
log "Expo PID: $(cat "$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.pid")"
log "Expo URL: exp://$DOMAIN:$EXPO_PORT"
log "Web URL: https://$DOMAIN/webapp/"
log "Log file: $LOG_FILE"
tail -n 80 "$LOG_FILE" || true
