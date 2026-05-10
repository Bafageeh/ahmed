#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/ahmed}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
EXPO_PORT="${AHMED_EXPO_PORT:-8082}"
API_DIR="$PROJECT_PATH/ahmed-api"
WEB_DIR="$PROJECT_PATH/ahmed-web"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"
RUNTIME_BASE="/home/pmsa/apps"

if [ ! -d "$RUNTIME_BASE" ]; then
  RUNTIME_BASE="$PROJECT_PATH/.runtime"
fi

log() { echo "[Ahmed Deploy] $1"; }

log "Starting deployment in $PROJECT_PATH"

if [ ! -d "$PROJECT_PATH/.git" ]; then
  echo "ERROR: $PROJECT_PATH is not a Git repository." >&2
  exit 1
fi

cd "$PROJECT_PATH"
log "Fetching latest main branch"
git fetch origin main
git reset --hard origin/main

if [ -d "$API_DIR" ]; then
  log "Installing Laravel dependencies"
  cd "$API_DIR"
  composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    php artisan key:generate --force
  fi
  log "Clearing Laravel caches"
  php artisan optimize:clear
  log "Running Laravel migrations"
  php artisan migrate --force
fi

cd "$PROJECT_PATH"
for patch in scripts/patch-moneymoon-topbar.py scripts/patch-moneymoon-add-edit-flow.py scripts/patch-moneymoon-compact-inline-edit.py scripts/patch-basic-income-compact.py scripts/patch-income-linked-sync-ui.py scripts/patch-ahmed-icons.py; do
  if [ -f "$patch" ]; then
    log "Running $patch"
    python3 "$patch" || true
  fi
done

if [ -d "$WEB_DIR" ]; then
  log "Building React web app"
  cd "$WEB_DIR"
  npm install
  npm run build
  log "Publishing web build to Laravel public/webapp"
  rm -rf "$API_DIR/public/webapp"
  mkdir -p "$API_DIR/public/webapp"
  cp -a "$WEB_DIR/dist/." "$API_DIR/public/webapp/"
fi

if [ -d "$MOBILE_DIR" ]; then
  log "Starting Expo on port $EXPO_PORT"
  cd "$MOBILE_DIR"
  echo "EXPO_PUBLIC_API_URL=https://$DOMAIN/api" > .env

  log "Installing or repairing mobile dependencies"
  npm install --legacy-peer-deps
  npm ls @expo/vector-icons >/dev/null 2>&1 || npm install @expo/vector-icons --legacy-peer-deps

  mkdir -p "$RUNTIME_BASE/.cache" "$RUNTIME_BASE/.tmp"
  LOG_FILE="$RUNTIME_BASE/ahmed-expo-$EXPO_PORT.log"
  touch "$LOG_FILE"
  : > "$LOG_FILE"

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$EXPO_PORT" -sTCP:LISTEN | xargs -r kill -9 || true
  fi
  pkill -f "expo.*--port $EXPO_PORT" || true
  pkill -f "metro.*$EXPO_PORT" || true
  pkill -f "React Native DevTools" || true

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
  sleep 8

  log "Expo log: $LOG_FILE"
  tail -n 60 "$LOG_FILE" || true
fi

if command -v php >/dev/null 2>&1 && [ -d "$API_DIR" ]; then
  cd "$API_DIR"
  log "Optimizing Laravel"
  php artisan config:cache || true
  php artisan route:cache || true
fi

log "Deployment finished"
log "Web: https://$DOMAIN"
log "API: https://$DOMAIN/api/health"
log "Expo: exp://$DOMAIN:$EXPO_PORT"
