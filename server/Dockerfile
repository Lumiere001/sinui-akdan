# syntax=docker/dockerfile:1.6
# 신의 악단 (sinui-akdan) Server — Render Web Service 용 Docker 이미지
# Express 5 + Socket.io 백엔드를 컨테이너로 패키징

# ========== Stage 1: Build ==========
FROM node:20-alpine AS builder

WORKDIR /app

# package*.json 복사 후 의존성 설치 (캐시 효율화)
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY tsconfig.json ./
COPY shared ./shared
COPY *.ts ./

# TypeScript → JavaScript 컴파일
RUN npm run build

# ========== Stage 2: Runtime ==========
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# 운영용 의존성만 설치
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist

# Render는 PORT를 주입하며, 그렇지 않은 환경에서는 3001을 기본값으로 사용
ENV PORT=3001
EXPOSE 3001

# Health check (Render의 health check path: /health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/index.js"]
