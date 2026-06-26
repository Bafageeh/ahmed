#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only || true
fi

python3 scripts/enable_personal_expenses_screen.py

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add ahmed-mobile/AppShell.js
  if ! git diff --cached --quiet; then
    git commit -m "Enable personal expenses screen in accounts" || true
    git push || true
  fi
fi

cd ahmed-api
php artisan migrate --force

echo "تم تجهيز شاشة مصروفاتي وربطها وتشغيل تحديث قاعدة البيانات."
