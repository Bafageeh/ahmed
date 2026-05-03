#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${AHMED_PROJECT_PATH:-/mnt/home-storage/home/pmsa/apps/ahmed}"
EXPO_PORT="${AHMED_EXPO_PORT:-8083}"
DOMAIN="${AHMED_DOMAIN:-ahmed.pm.sa}"
MOBILE_DIR="$PROJECT_PATH/ahmed-mobile"

cd "$MOBILE_DIR"
mkdir -p /home/pmsa/apps/.cache /home/pmsa/apps/.tmp

if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS=$(lsof -ti:"$EXPO_PORT" || true)
  if [ -n "$OLD_PIDS" ]; then
    echo "$OLD_PIDS" | xargs -r kill || true
    sleep 2
    echo "$OLD_PIDS" | xargs -r kill -9 || true
  fi
fi

nohup env BROWSER=none EXPO_NO_TELEMETRY=1 REACT_NATIVE_PACKAGER_HOSTNAME="$DOMAIN" XDG_CACHE_HOME=/home/pmsa/apps/.cache TMPDIR=/home/pmsa/apps/.tmp TMP=/home/pmsa/apps/.tmp TEMP=/home/pmsa/apps/.tmp npx expo start --clear --go --host lan --port "$EXPO_PORT" > /home/pmsa/apps/ahmed-expo.log 2>&1 &

sleep 8
tail -80 /home/pmsa/apps/ahmed-expo.log || true
