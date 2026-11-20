#!/bin/bash
# macOS/Linux용 공개 주소 열기 (tunnel.bat과 같은 일)
cd "$(dirname "$0")" || exit 1

if ! command -v cloudflared >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "[gachi-gage] cloudflared is not installed. Installing it with Homebrew..."
    brew install cloudflared || { read -r -p "Install failed. Press Enter to close..."; exit 1; }
  else
    echo "[gachi-gage] cloudflared is not installed. Install Homebrew (https://brew.sh) and run: brew install cloudflared"
    read -r -p "Press Enter to close..."
    exit 1
  fi
fi

echo "[gachi-gage] Keep start.command running, then wait for the line with https://....trycloudflare.com below."
echo "[gachi-gage] Paste that address into the web page: last menu tab (account connection) - public address box."
echo "[gachi-gage] Close this window after the demo to stop public access."
echo
cloudflared tunnel --url http://localhost:3000
