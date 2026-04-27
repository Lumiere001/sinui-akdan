# syntax=docker/dockerfile:1.6
# 신의 악단 (sinui-akdan) Client — React + Vite SPA를 컨테이너로 패키징
# 운영 배포는 Render Static Site로 하지만, 로컬 일관성 검증과 Stage 3(Docker)
# 단계 증빙을 위해 nginx 기반 정적 서빙 이미지를 함께 제공한다.

# ========== Stage 1: Build ==========
FROM node:20-alpine AS builder

WORKDIR /app

# package*.json 먼저 복사 (캐시 활용)
COPY package*.json ./
RUN npm ci

# 빌드 시점에 주입되는 환경변수 (Vite는 빌드 타임에 정적 치환)
ARG VITE_SERVER_URL
ARG VITE_KAKAO_MAP_KEY
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV VITE_KAKAO_MAP_KEY=${VITE_KAKAO_MAP_KEY}

# 소스 복사 후 빌드
COPY . .
RUN npm run build

# ========== Stage 2: Runtime (nginx) ==========
FROM nginx:1.27-alpine AS runtime

# SPA fallback + gzip 등을 처리하는 nginx 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite 빌드 결과물 배포
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
