#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/ahmed}"
EXPO_PORT="${AHMED_EXPO_PORT:-8083}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"

API_DIR="$PROJECT_PATH/ahmed-api"
WEB_DIR="$PROJECT_PATH/ahmed-web"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"

log() {
  echo "[Ahmed Deploy] $1"
}

log "Starting deployment in $PROJECT_PATH"

if [ ! -d "$PROJECT_PATH/.git" ]; then
  echo "ERROR: $PROJECT_PATH is not a Git repository." >&2
  exit 1
fi

cd "$PROJECT_PATH"

log "Fetching latest main branch"
git fetch origin main
git reset --hard origin/main
git clean -fd --exclude='ahmed-api/.env' --exclude='ahmed-mobile/.env' --exclude='ahmed-api/storage' --exclude='ahmed-api/vendor' --exclude='ahmed-web/node_modules' --exclude='ahmed-mobile/node_modules'

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
if [ -f scripts/patch-moneymoon-topbar.py ]; then
  log "Patching MoneyMoon mobile UI top bar"
  python3 scripts/patch-moneymoon-topbar.py
fi

if [ -f scripts/patch-moneymoon-add-edit-flow.py ]; then
  log "Patching MoneyMoon add screen and inline edit flow"
  python3 scripts/patch-moneymoon-add-edit-flow.py
fi

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
  log "Installing mobile dependencies"
  cd "$MOBILE_DIR"
  npm install

  if [ ! -f .env ]; then
    echo "EXPO_PUBLIC_API_URL=https://$DOMAIN/api" > .env
  fi

  cd "$PROJECT_PATH"
  log "Restarting Expo development server"
  chmod +x scripts/restart-expo-ahmed.sh
  bash scripts/restart-expo-ahmed.sh
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
