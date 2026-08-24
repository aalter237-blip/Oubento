#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets/www"
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$ROOT/index.html" "$ROOT/manifest.json" "$ROOT/sw.js" "$DEST/"
cp -r "$ROOT/css" "$ROOT/js" "$ROOT/assets" "$DEST/"
# launcher icon
mkdir -p "$ROOT/android/app/src/main/res/mipmap-xxxhdpi"
cp "$ROOT/assets/branding/icon-192.png" "$ROOT/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
echo "Synced web OS into $DEST"
