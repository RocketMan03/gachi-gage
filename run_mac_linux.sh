#!/bin/sh
# 같이가게 MVP - Mac/Linux 터미널 실행:  ./run_mac_linux.sh   (또는  sh run_mac_linux.sh)
cd "$(dirname "$0")" || exit 1
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
# Mac은 5000번을 AirPlay 수신이 쓰고 있어서 5001번을 기본으로 써요.
if [ "$(uname)" = "Darwin" ]; then PORT="${PORT:-5001}"; else PORT="${PORT:-5000}"; fi
echo "브라우저에서 http://127.0.0.1:$PORT 을 열어 주세요. 끄려면 Ctrl + C"
PORT="$PORT" .venv/bin/python app.py
