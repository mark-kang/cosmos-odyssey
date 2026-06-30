#!/bin/bash

# =========================================================================
# Project We-Go 로컬 리눅스 개발 서버 원스톱 배포 자동화 스크립트
# =========================================================================

SERVER_IP="192.168.0.114"
SERVER_USER="marky"
DEST_DIR="~/cosmos-odyssey"

echo "🚀 [1/3] 원격 리눅스 서버($SERVER_IP)로 코드 전송 (rsync)..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'client/node_modules' \
  --exclude 'client/dist' \
  --exclude 'server/node_modules' \
  --exclude 'server/dist' \
  ./ ${SERVER_USER}@${SERVER_IP}:${DEST_DIR}

echo "📦 [2/3] 원격 서버에서 종속성 설치 및 클라이언트 빌드..."
ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${DEST_DIR} && \
  npm install --prefix client && \
  npm install --prefix server && \
  npm run build --prefix client && \
  npm run build --prefix server
"

echo "🔥 [3/3] 통합 웹/API 서버 백그라운드 재기동..."
ssh ${SERVER_USER}@${SERVER_IP} "
  cd ${DEST_DIR}/server && \
  if command -v pm2 &> /dev/null; then
    echo '⚙️ pm2를 사용하여 백그라운드 프로세스를 재기동합니다...'
    pm2 restart cosmos-server || pm2 start dist/server/src/index.js --name cosmos-server
  else
    echo '⚠️ pm2가 감지되지 않아 nohup 백그라운드 프로세스로 기동합니다...'
    pkill -f 'node dist/server/src/index.js' || true
    nohup node dist/server/src/index.js > server.log 2>&1 &
  fi
"

echo "✨ [완료] 원격 로컬 서버 배포가 정상적으로 마무리되었습니다!"
echo "👉 스마트폰/PC 웹 접속 주소: http://${SERVER_IP}:3000"
