#!/bin/bash
# 같이가게 MVP - Mac에서 더블클릭으로 실행
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3가 필요해요. https://www.python.org/downloads/ 에서 설치한 뒤 다시 실행해 주세요."
  read -r -p "Enter를 누르면 창이 닫혀요."
  exit 1
fi

if [ ! -d .venv ]; then
  echo "[1/3] 처음 실행이라 준비하고 있어요..."
  python3 -m venv .venv || { echo "가상환경을 만들지 못했어요."; read -r; exit 1; }
fi
echo "[2/3] 필요한 패키지를 확인하고 있어요..."
.venv/bin/pip install -q -r requirements.txt || { echo "패키지 설치에 실패했어요. 인터넷 연결을 확인해 주세요."; read -r; exit 1; }

# Mac은 5000번을 AirPlay 수신이 쓰고 있어서 5001번을 써요.
PORT="${PORT:-5001}"
echo "[3/3] 서버를 켜요. 브라우저에서 http://127.0.0.1:$PORT 이 열려요. 끄려면 Ctrl + C"
(sleep 3; open "http://127.0.0.1:$PORT") &
PORT="$PORT" .venv/bin/python app.py
