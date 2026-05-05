#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/ahmed}"
EXPO_PORT="${AHMED_EXPO_PORT:-8083}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"

cd "$MOBILE_DIR"
mkdir -p /home/pmsa/apps/.cache /home/pmsa/apps/.tmp

# Stop any old Expo/Metro server for Ahmed. A stale Metro process can leave Expo Go
# stuck on the splash screen with "New update available, downloading...".
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS=$(lsof -ti:"$EXPO_PORT" || true)
  if [ -n "$OLD_PIDS" ]; then
    echo "$OLD_PIDS" | xargs -r kill || true
    sleep 2
    echo "$OLD_PIDS" | xargs -r kill -9 || true
  fi
fi

pkill -f "expo.*$EXPO_PORT" || true
pkill -f "metro.*$EXPO_PORT" || true
pkill -f "node.*$EXPO_PORT" || true
sleep 2

# Remove Metro/Expo local caches before starting.
rm -rf /home/pmsa/apps/.cache/metro /home/pmsa/apps/.cache/expo /home/pmsa/apps/.tmp/metro-* 2>/dev/null || true
rm -rf .expo 2>/dev/null || true

nohup env CI=1 BROWSER=none EXPO_NO_TELEMETRY=1 REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN" XDG_CACHE_HOME=/home/pmsa/apps/.cache TMPDIR=/home/pmsa/apps/.tmp TMP=/home/pmsa/apps/.tmp TEMP=/home/pmsa/apps/.tmp npx expo start --clear --go --host lan --port "$EXPO_PORT" > /home/pmsa/apps/ahmed-expo.log 2>&1 &

sleep 10
tail -120 /home/pmsa/apps/ahmed-expo.log || true
