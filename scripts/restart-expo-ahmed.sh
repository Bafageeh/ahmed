#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/ahmed}"
EXPO_PORT="${AHMED_EXPO_PORT:-8083}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"
CACHE_DIR="$MOBILE_DIR/.expo-cache"
TMP_DIR="$MOBILE_DIR/.expo-tmp"
LOG_FILE="/home/pmsa/apps/ahmed-expo.log"

cd "$MOBILE_DIR"
mkdir -p "$CACHE_DIR" "$TMP_DIR"
chmod -R u+rwX "$CACHE_DIR" "$TMP_DIR" 2>/dev/null || true

# Stop any old Expo/Metro server for Ahmed.
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

# Use project-local cache/temp folders. This avoids old root-owned files under
# /home/pmsa/apps/.tmp/metro-cache that can block Metro startup with EACCES.
rm -rf "$CACHE_DIR"/* "$TMP_DIR"/* .expo 2>/dev/null || true
mkdir -p "$CACHE_DIR" "$TMP_DIR"
chmod -R u+rwX "$CACHE_DIR" "$TMP_DIR" 2>/dev/null || true

nohup env \
  CI=1 \
  BROWSER=none \
  EXPO_NO_TELEMETRY=1 \
  REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN" \
  XDG_CACHE_HOME="$CACHE_DIR" \
  TMPDIR="$TMP_DIR" \
  TMP="$TMP_DIR" \
  TEMP="$TMP_DIR" \
  npx expo start --clear --go --host lan --port "$EXPO_PORT" > "$LOG_FILE" 2>&1 &

sleep 10
tail -120 "$LOG_FILE" || true
