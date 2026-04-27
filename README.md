# 신의 악단 (sinui-akdan)

> **DevOps 파이프라인 중간 과제 — 김동규 / 학번 223402**
> Git → CI(GitHub Actions) → Docker → Render 의 전 과정을 한 줄기로 구축한 개인 프로젝트입니다.

광주 CCC 교회 D&I 행사용으로 만든 GPS 기반 실외 보물찾기 웹 앱이며, 본 저장소는 **DevOps 파이프라인 과제 제출본**으로 Git → CI(GitHub Actions) → Docker → Render 4단계 자동화 파이프라인이 적용되어 있습니다.

---

## 1. 라이브 데모 & 테스트 접속 정보

| 구분 | URL |
|------|-----|
| 사용자 페이지 (Frontend) | _Render 배포 후 채워주세요: `https://sinui-akdan-client.onrender.com`_ |
| 관리자 페이지 | _위 URL 뒤에 `/admin`_ |
| API 서버 (Backend) | _`https://sinui-akdan-server.onrender.com`_ |
| 헬스체크 | _`<API URL>/health`_ |

> ⚠️ **Render Free Plan의 cold start**: 15분 무사용 후 첫 요청은 30초 가량 느릴 수 있습니다. 헬스체크 URL에 한 번 접속해 깨운 뒤 시연하세요.

### 데모 자격증명

| 용도 | 값 |
|------|-----|
| 관리자 비밀번호 | `admin2024` (기본값, Render `ADMIN_PASSWORD` 환경변수로 재정의 가능) |
| 팀별 비밀번호 (1~10팀) | `3847 / 5291 / 7463 / 1926 / 8052 / 4739 / 6185 / 2574 / 9318 / 5607` |

---

## 2. 교수님 테스트 시나리오 (5분 코스)

> 이 게임은 원래 광주 양림동 현장에서 GPS로 진행하는 실외 미션입니다. 교수님은 현장에 가지 않으시므로 **관리자 페이지의 "테스트 모드 + 강제 해금"** 기능으로 전 단계를 책상에서 확인하실 수 있도록 설계되어 있습니다.

### Step 1. 관리자 페이지 접속
1. `<클라이언트 URL>/admin` 접속
2. 비밀번호 `admin2024` 입력

### Step 2. 테스트 모드로 전환
- 관리자 화면에서 **"테스트 모드"** 토글을 켭니다.
- 각 Stage 시간이 **30분 → 1분**으로 줄어들어 자동 전환을 빠르게 확인할 수 있습니다.

### Step 3. 게임 시작 & Stage 1
- 관리자 화면에서 **"전체 게임 시작 (Master Start)"** 클릭
- 가조(팀 1~5)는 Stage 1, 나조(팀 6~10)는 Stage 2로 시작됨이 화면에 표시됩니다.
- 임의의 가조 팀을 선택해 **"Stage 1 완료 기록"** 버튼을 누르면 해당 팀이 Stage 2로 자동 전환됩니다.

### Step 4. Stage 2 — GPS 미션 강제 해금
- 현장 GPS가 없어도 관리자 화면의 **"Stage 2 강제 해금 (Force Advance Step)"** 버튼으로 각 팀의 다음 단계를 진행시킬 수 있습니다.
- 3단계까지 모두 강제 해금하면 Stage 2 완료가 기록됩니다.

### Step 5. Stage 3 진입 / 마무리
- 1분 경과 후 자동으로 Stage 3로 전환됩니다 (또는 **"Stage 건너뛰기"** 사용).
- 모든 Stage가 끝나면 `finished` 상태로 전환됩니다.

### Step 6. 사용자 페이지 동시 확인 (선택)
- 다른 탭에서 **`/`** (사용자 페이지) 접속 → 팀 번호 + 비밀번호로 로그인
- 같은 게임 상태가 실시간(Socket.io)으로 동기화되는 모습을 볼 수 있습니다.
- Stage 2 진입 시 첫 미션 힌트 카드가 자동으로 보여집니다.

---

## 3. DevOps 파이프라인 (과제 핵심)

```
[ 로컬 개발 ]
      │  git commit
      ▼
[ GitHub: Lumiere001/sinui-akdan ]
      │  git push (main / PR)
      ▼
[ Stage 1: Git/GitHub ]
      │
      ▼
[ Stage 2: GitHub Actions (CI) ]   ── .github/workflows/ci.yml
   ├─ server: typecheck → vitest 27 tests → tsc build
   ├─ client: lint → vite build
   └─ docker-verify: server/client 이미지 빌드 + /health 컨테이너 동작 검증
      │
      ▼
[ Stage 3: Docker 패키징 ]   ── server/Dockerfile, client/Dockerfile
      │  Render가 Dockerfile로 이미지 빌드
      ▼
[ Stage 4: Render 배포 ]   ── render.yaml (Blueprint)
   ├─ sinui-akdan-server (Web Service, Docker)
   └─ sinui-akdan-client (Static Site, Vite)
      │
      ▼
[ Production — 외부 접근 가능 ]
```

수업의 표준 4단계 파이프라인을 그대로 구현했고, **모든 단계가 GitHub push 한 번으로 자동 연결**됩니다.

---

## 4. 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Socket.io Client |
| Backend | Express 5, Socket.io, TypeScript |
| 지도 | Kakao Maps API (JavaScript SDK) |
| 테스트 | Vitest (서버 27 테스트) |
| CI/CD | GitHub Actions |
| 컨테이너 | Docker (multi-stage), nginx (클라이언트 정적 서빙) |
| 배포 | Render (Web Service + Static Site) |

---

## 5. 로컬 개발

```bash
# 서버
cd server
npm install
npm run dev          # http://localhost:3001

# 클라이언트 (다른 터미널)
cd client
npm install
npm run dev          # http://localhost:5173
```

### 환경 변수

**Frontend** (`client/.env.local`)
```
VITE_KAKAO_MAP_KEY=<카카오맵 JS 키>
VITE_SERVER_URL=http://localhost:3001
```

**Backend** (`server/.env`)
```
PORT=3001
ADMIN_PASSWORD=admin2024
CLIENT_URL=http://localhost:5173
EXTRA_ALLOWED_ORIGINS=
```

### 테스트 실행

```bash
cd server
npm test             # vitest run — 27개 단위 테스트
```

---

## 6. Docker 실행

### 서버 컨테이너만 실행
```bash
cd server
docker build -t sinui-akdan-server .
docker run -p 3001:3001 \
  -e ADMIN_PASSWORD=admin2024 \
  -e CLIENT_URL=http://localhost:8080 \
  sinui-akdan-server
```

### 클라이언트 컨테이너만 실행
```bash
cd client
docker build \
  --build-arg VITE_SERVER_URL=http://localhost:3001 \
  --build-arg VITE_KAKAO_MAP_KEY=<카카오맵 JS 키> \
  -t sinui-akdan-client .
docker run -p 8080:80 sinui-akdan-client
# http://localhost:8080
```

CI에서도 매 push 시 위 두 이미지를 빌드하고 서버 컨테이너의 `/health` 엔드포인트가 응답하는지 검증합니다.

---

## 7. CI 워크플로 요약 (`.github/workflows/ci.yml`)

| Job | 수행 작업 |
|-----|----------|
| `server` | Node 20 → `npm ci` → `tsc --noEmit` (타입체크) → `npm test` (vitest 27개) → `tsc` (빌드) → 출력 검증 |
| `client` | Node 20 → `npm ci` → `npm run lint` (ESLint) → `npm run build` (vite) → 출력 검증 |
| `docker-verify` | Buildx로 server/client Dockerfile 빌드 → 서버 컨테이너 실행 → `/health` curl로 응답 확인 |

CI가 모두 통과해야 main에 머지/푸시될 수 있고, main 푸시 시 Render가 자동 재배포합니다.

---

## 8. 배포 (Render)

저장소 루트의 `render.yaml`이 두 서비스(`sinui-akdan-server`, `sinui-akdan-client`)를 정의합니다. Render 대시보드의 **New → Blueprint** 메뉴에서 이 저장소를 선택하면 자동으로 두 서비스가 생성됩니다.

### 환경변수 (Render 대시보드에서 입력)

| 서비스 | 키 | 값 |
|--------|-----|-----|
| server | `ADMIN_PASSWORD` | (임의 강한 비밀번호) |
| server | `CLIENT_URL` | `https://sinui-akdan-client.onrender.com` |
| server | `EXTRA_ALLOWED_ORIGINS` | (선택, 추가 허용 도메인) |
| client | `VITE_SERVER_URL` | `https://sinui-akdan-server.onrender.com` |
| client | `VITE_KAKAO_MAP_KEY` | (Kakao Developers 콘솔의 JavaScript 키) |

> 카카오맵을 띄우려면 Kakao Developers 콘솔 → 플랫폼 → Web → 사이트 도메인에 클라이언트 Render 도메인을 추가해야 합니다.

---

## 9. 게임 룰 (참고)

### 팀 구성
- 가조 (팀 1~5): Stage 1 → Stage 2 → Stage 3
- 나조 (팀 6~10): Stage 2 → Stage 1 → Stage 3

### Stage 시간 (실전 모드)
- Stage 1: 30분 / Stage 2: 32분 / Stage 3: 30분

### Stage 2 미션 규칙
- 각 팀은 3개의 장소를 순서대로 탐색
- 각 단계마다 정답 1곳 + 오답 1곳 제시
- 팀원 **3명 이상**이 정답 장소 **40m 이내**에 모여야 해금
- 오답 장소 선택 시 이동 페널티 발생
- 3개 장소 모두 정답 시 Stage 2 자동 완료

### 양림동 미션 장소 (9곳)
| ID | 장소명 |
|----|--------|
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

## 10. 디렉토리 구조

```
sinui-akdan/
├── .github/workflows/ci.yml     # CI: lint/typecheck/test/build/docker-verify
├── render.yaml                  # Render Blueprint (Server + Client)
├── client/
│   ├── src/                     # React 19 + TS
│   ├── Dockerfile               # nginx 기반 정적 서빙 이미지
│   ├── nginx.conf               # SPA fallback + 캐시 설정
│   └── vite.config.ts
├── server/
│   ├── index.ts                 # Express + Socket.io
│   ├── gameState.ts / gameData.ts / gpsCheck.ts / adminRoutes.ts
│   ├── shared/types.ts          # 게임 타입 + Stage 계산 함수
│   ├── tests/                   # vitest 단위 테스트 (27개)
│   ├── Dockerfile               # Node 20 multi-stage 이미지
│   └── tsconfig.json
└── shared/types.ts              # 클라이언트-서버 공유 타입(레거시)
```

---

## 11. 라이선스

본 저장소는 전남대학교 AI융합대학 인공지능학부 DevOps 파이프라인 수업의 개인 과제용으로 공개되어 있습니다. 게임 자체는 광주 CCC 교회 D&I 행사를 위해 제작되었습니다.
