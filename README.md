# 신의 악단 (sinui-akdan)

![CI](https://github.com/Lumiere001/sinui-akdan/actions/workflows/ci.yml/badge.svg?branch=main)

> 광주 양림동 일대를 무대로 한 **GPS 기반 실외 보물찾기 웹앱**입니다. 50명 규모 실서비스로 운영된 코드를 **Git → CI → Docker → Render** 4단계 DevOps 파이프라인으로 재구성한 개인 프로젝트입니다.

| | |
|---|---|
| **사용자 페이지** | <https://sinui-akdan-client.onrender.com> |
| **관리자 페이지** | <https://sinui-akdan-client.onrender.com/admin>  ·  비밀번호 `admin2024` |
| **API 헬스체크** | <https://sinui-akdan-server.onrender.com/health> |
| **GitHub** | <https://github.com/Lumiere001/sinui-akdan>  (Public) |

> ⚠️ **Render Free 플랜의 cold start**: 15분 무사용 후 첫 요청은 30초 정도 느립니다. 시연 직전 헬스체크 URL을 한 번 호출해 컨테이너를 깨워두세요.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [게임 소개](#2-게임-소개)
3. [DevOps 파이프라인](#3-devops-파이프라인)
4. [교수님 테스트 가이드 (5분 코스)](#4-교수님-테스트-가이드-5분-코스)
5. [로컬 개발](#5-로컬-개발)
6. [디렉토리 구조](#6-디렉토리-구조)

---

## 1. 프로젝트 개요

### 무엇을 만들었나

| 구분 | 내용 |
|---|---|
| **목적** | 광주 CCC 교회 D&I 행사용 GPS 보물찾기 게임 → 행사 종료 후 DevOps 파이프라인 학습 프로젝트로 재구성 |
| **운영 일자** | 2026-04-11 (토) — 실제 50명 규모 행사에서 사용됨 |
| **핵심 기능** | 실시간 GPS 위치 판정 · 벽시계 기반 자동 Stage 전환 · Socket.io 동기화 · 관리자 페이지 |
| **기술 스택** | React 19 + Vite (client) / Express 5 + Socket.io (server) / Kakao Maps SDK / Vitest |
| **운영 호스팅** | Render — Web Service (Docker) + Static Site |

### 실서비스 검증 통계

`data_backup.json` 기반 익명화 집계 (2026-04-11 행사 당일).

| 지표 | 측정값 |
|---|---|
| 참가 인원 | **48명 / 10팀** (가조 5팀 + 나조 5팀, 평균 4.8명) |
| Stage 2 완주율 | **50%** (5/10팀이 GPS 미션 3단계 완주) |
| Stage 2 평균 완주 시간 | **25.9분** (최단 22.7분 / 최장 30.2분) |
| 총 GPS 시도 | 59회 (정답 22 / 오답 37 → 정답률 37%) |
| 최다 오답 기록 | 한 단계에서 **8회 연속 오답** → 페널티 시스템이 의도대로 작동 |
| GPS 좌표 기록 | 41건 모두 양림동 일대 정상 범위 |
| 운영 시간 | 11.4시간 (사전 점검 포함) |

> 행사 참가자 PII가 포함된 원본 백업 파일은 git 추적에서 제거되어 있습니다 (`.gitignore` 등록 + CI 가드).

---

## 2. 게임 소개

### 한 줄 컨셉

> 양림동의 숨겨진 9개 역사적 장소를 GPS로 찾아 단계를 클리어하는 **협동형 보물찾기**.

### 팀 구성과 진행 순서

| 그룹 | 팀 | 진행 순서 |
|---|---|---|
| **가조** | 1 ~ 5팀 | Stage 1 → Stage 2 → Stage 3 |
| **나조** | 6 ~ 10팀 | Stage 2 → Stage 1 → Stage 3 |

두 그룹이 시간대를 교차하여 한 라운드에 5팀씩 야외에서 진행한다. 모든 전환은 서버 벽시계(wall-clock) 기준 자동.

### Stage 별 미션

| Stage | 내용 | 시간(실전 / 테스트) |
|---|---|---|
| **1** | 실내 방탈출 — 관리자가 완료 수동 기록 | 30 분 / 1 분 |
| **2** | **야외 GPS 미션 (핵심)** — 9개 장소 중 3곳을 순서대로 탐색 | 32 분 / 1 분 |
| **3** | 전체 합동 협동 미션 | 30 분 / 1 분 |

### Stage 2 GPS 미션 룰

1. 각 팀에 3개 단계가 주어지며, 단계마다 **정답 장소 1곳 + 오답 장소 1곳**이 힌트로 제공된다.
2. 팀원 **3명 이상이 정답 장소 40m 이내**에 모이면 단계가 자동 해금된다.
3. **오답 장소를 누르면 이동 페널티**가 발생한다.
4. 3개 단계를 모두 정답으로 클리어하면 Stage 2 완료가 자동 기록된다.

### 양림동 미션 장소 (9곳)

| ID | 장소명 |
|---|---|
| 1 | 오웬기념각 |
| 2 | 선교사 묘역 |
| 3 | 우일선 선교사 사택 |
| 4 | 커티스메모리얼홀 |
| 5 | 이장우 가옥 |
| 6 | 펭귄마을 |
| 8 | 양림교회 |
| 10 | 조아라 기념관 |
| 11 | 호랑가시나무 |

---

## 3. DevOps 파이프라인

수업의 표준 4단계(Git/GitHub → CI → Docker → Render)를 그대로 구현했다. **GitHub push 한 번이면 자동 검증 → 자동 배포까지 한 줄기로** 이어진다.

```
[ 로컬 개발 ]
       │  git commit (Conventional Commits)
       ▼
[ Stage 1: Git/GitHub ]   github.com/Lumiere001/sinui-akdan
       │  git push (main / PR)
       ▼
[ Stage 2: CI (GitHub Actions) ]   .github/workflows/ci.yml
   ├─ server  : shared types diff → typecheck → vitest 27 tests → tsc build
   ├─ client  : lint → vite build (typecheck + Rolldown 번들)
   └─ docker-verify : server 이미지 빌드 + 컨테이너 /health 응답 검증
       │  CI 통과 시에만 머지 가능
       ▼
[ Stage 3: Docker 패키징 ]   server/Dockerfile (Node 20 multi-stage)
       │  Render 가 이 Dockerfile 로 이미지 빌드
       ▼
[ Stage 4: Render 배포 ]   render.yaml (Blueprint, IaC)
   ├─ sinui-akdan-server : Web Service (Docker, /health 헬스체크)
   └─ sinui-akdan-client : Static Site (Vite 빌드 → CDN)
       │
       ▼
[ Production — 외부 접근 가능 ]
```

### CI 잡 구성 (`.github/workflows/ci.yml`)

| Job | 수행 작업 |
|---|---|
| **server** | `npm ci` → shared types diff → `tsc --noEmit` → `npm test` (vitest 27개) → `npm run build` |
| **client** | `npm ci` → `npm run lint` (ESLint) → `npm run build` (`tsc -b && vite build`) |
| **docker-verify** | Buildx로 server 이미지 빌드 → 컨테이너 실행 → `/health` 응답 확인 |

### Docker 적용 범위

| 서비스 | Docker 사용 | 배포 형태 |
|---|---|---|
| **server** | ✅ Node 20 multi-stage 이미지 | Render Web Service (Docker 런타임) |
| **client** | ❌ 사용 안 함 | Render Static Site (Vite 빌드 결과 CDN 정적 호스팅) |

> Static Site는 글로벌 CDN으로 더 빠르고 비용도 무료라, 클라이언트는 컨테이너화하지 않는 것이 본 파이프라인의 명시적 설계 결정입니다.

---

## 4. 교수님 테스트 가이드 (5분 코스)

> 본 게임은 원래 광주 양림동 현장에서 GPS로 진행하는 실외 미션이지만, 교수님은 **관리자 페이지의 "테스트 모드 + 강제 해금"** 기능으로 책상에서 전 단계를 빠르게 확인하실 수 있습니다.

### Step 1 — 관리자 페이지 접속

[`/admin`](https://sinui-akdan-client.onrender.com/admin) 접속 → 비밀번호 `admin2024` 로그인.

### Step 2 — 테스트 모드 켜기

상단의 **"테스트 모드"** 토글을 켭니다. 각 Stage 시간이 **30분 → 1분**으로 단축됩니다.

### Step 3 — 게임 시작

**"전체 게임 시작 (Master Start)"** 클릭. 가조(팀 1~5)는 Stage 1, 나조(팀 6~10)는 Stage 2로 즉시 시작됩니다.

### Step 4 — Stage 진행 확인

- 가조 임의 팀 카드의 **"Stage 1 완료 기록"** 클릭 → 해당 팀이 Stage 2로 자동 전환.
- 나조 임의 팀 카드의 **"Stage 2 강제 해금"** 3회 클릭 → 3단계 모두 강제 해금되어 Stage 2 완료 기록.

### Step 5 — Stage 3 진입 / 마무리

1분 경과 시 자동으로 Stage 3로 전환되거나, **"Stage 건너뛰기"** 로 즉시 이동. 모든 Stage 완료 시 `finished` 상태가 됩니다.

### Step 6 — 사용자 페이지 동시 확인 (선택)

다른 탭에서 [사용자 페이지](https://sinui-akdan-client.onrender.com)를 열어 팀 번호 + 비밀번호로 로그인하면, 관리자 화면과 **실시간 동기화 (Socket.io)** 되는 모습을 볼 수 있습니다. 팀별 비밀번호는 행사 종료된 값으로 `server/index.ts` 의 `TEAM_PASSWORDS` 상수에서 확인 가능합니다.

---

## 5. 로컬 개발

### 환경변수

**Frontend** — `client/.env.local`

```
VITE_KAKAO_MAP_KEY=<카카오맵 JS 키>
VITE_SERVER_URL=http://localhost:3001
```

**Backend** — `server/.env`

```
PORT=3001
ADMIN_PASSWORD=admin2024
CLIENT_URL=http://localhost:5173
EXTRA_ALLOWED_ORIGINS=
```

### 실행

```bash
# 서버 (터미널 1)
cd server
npm install
npm run dev          # http://localhost:3001

# 클라이언트 (터미널 2)
cd client
npm install
npm run dev          # http://localhost:5173
```

### 단위 테스트

```bash
cd server
npm test             # vitest run — 27개 테스트
```

### Docker (server)

```bash
cd server
docker build -t sinui-akdan-server .
docker run -p 3001:3001 \
  -e ADMIN_PASSWORD=admin2024 \
  -e CLIENT_URL=http://localhost:5173 \
  sinui-akdan-server
```

---

## 6. 디렉토리 구조

```
sinui-akdan/
├── .github/workflows/ci.yml   # CI: server / client / docker-verify
├── render.yaml                # Render Blueprint (server + client)
├── client/                    # React 19 + Vite SPA
│   ├── src/
│   ├── eslint.config.js
│   └── vite.config.ts
├── server/                    # Express 5 + Socket.io + TypeScript
│   ├── index.ts               # 진입점
│   ├── gameState.ts / gameData.ts / gpsCheck.ts / adminRoutes.ts
│   ├── shared/types.ts        # 공유 타입 (root shared 와 CI 가드로 동기화)
│   ├── tests/                 # vitest 단위 테스트 27개
│   └── Dockerfile             # Node 20 multi-stage
├── shared/types.ts            # 클라이언트가 참조하는 공유 타입 정본
└── docs/archive/              # 옛 V2 시점 설계 문서 보관소
```

---

본 저장소는 전남대학교 AI융합대학 인공지능학부 DevOps 파이프라인 수업의 개인 과제용으로 공개되어 있습니다.
