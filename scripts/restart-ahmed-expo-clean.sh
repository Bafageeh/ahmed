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

log "Applying final Ta3meed screen normalization"
MOBILE_DIR="$MOBILE_DIR" python3 - <<'PY'
import os
from pathlib import Path

path = Path(os.environ['MOBILE_DIR']) / 'Ta3meedCompactFiltersScreen.js'
text = path.read_text(encoding='utf-8')

old_reset = "          {hasFilters ? <TouchableOpacity style={styles.resetButton} onPress={resetFilters} activeOpacity={0.85}><Text style={styles.resetButtonText}>إعادة الفلتر إلى نشط</Text></TouchableOpacity> : null}\n"
text = text.replace(old_reset, '')

old_sort = "]).sort((a, b) => withdrawalSortValue(b) - withdrawalSortValue(a));"
new_sort = "]).sort((a, b) => {\n      const dateOf = (item) => String(item?.maturity_date || item?.due_date || '').slice(0, 10);\n      const valueOf = (item) => {\n        const dateText = dateOf(item);\n        if (!dateText) return null;\n        const value = new Date(`${dateText}T00:00:00`).getTime();\n        return Number.isFinite(value) ? value : null;\n      };\n      const aValue = valueOf(a);\n      const bValue = valueOf(b);\n      const aMissing = aValue === null;\n      const bMissing = bValue === null;\n      if (aMissing && !bMissing) return -1;\n      if (!aMissing && bMissing) return 1;\n      if (!aMissing && !bMissing && aValue !== bValue) return aValue - bValue;\n      return String(a?.reference_number || a?.code || a?.id || '').localeCompare(String(b?.reference_number || b?.code || b?.id || ''), 'ar');\n    });"
text = text.replace(old_sort, new_sort)

if 'إعادة الفلتر إلى نشط' in text:
    raise SystemExit('Reset filter button text still exists in Ta3meedCompactFiltersScreen.js')
if 'aMissing && !bMissing' not in text:
    raise SystemExit('Maturity sort was not applied in Ta3meedCompactFiltersScreen.js')

path.write_text(text, encoding='utf-8')
PY

log "Verifying Ta3meed entrypoint"
grep -n "import Ta3meedScreen from './Ta3meedNoResetFilterScreen'" "$MOBILE_DIR/AppShell.js" || {
  echo "ERROR: AppShell does not point to Ta3meedNoResetFilterScreen.js" >&2
  exit 1
}

grep -n "setPicker('investor')" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js" || {
  echo "ERROR: Ta3meed investor filter button does not open investor picker." >&2
  exit 1
}
if grep -n "إعادة الفلتر إلى نشط" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js"; then
  echo "ERROR: Reset filter button still exists." >&2
  exit 1
fi
grep -n "aMissing && !bMissing" "$MOBILE_DIR/Ta3meedCompactFiltersScreen.js" || {
  echo "ERROR: Maturity sort verification failed." >&2
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

  if grep -q "Ahmed Web Test\|Ahmed Web غير منشور\|نسخة الويب لم تُبنى بعد" "$WEB_EXPORT_DIR/index.html"; then
    echo "ERROR: Expo web export produced the old placeholder page." >&2
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
else
  log "Skipping web export because $API_DIR/public was not found"
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
