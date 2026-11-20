#!/bin/bash
# macOS/Linux용 실행 파일 (start.bat과 같은 일). Finder에서 더블클릭하거나 터미널에서 ./start.command
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "[gachi-gage] Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[gachi-gage] Installing packages for the first run..."
  npm install --no-audit --no-fund || { read -r -p "npm install failed. Press Enter to close..."; exit 1; }
fi

node server/setup-key.js

# 3초 뒤 브라우저 열기 (macOS: open, Linux: xdg-open)
( sleep 3; open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null ) &
npm start
