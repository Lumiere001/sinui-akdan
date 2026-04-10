# 신의 악단 (God's Orchestra)

광주 CCC 교회 D&I 행사를 위한 GPS 기반 실외 보물찾기 웹 앱입니다. 양림동 일대의 역사적 장소들을 탐험하며 팀별로 미션을 수행합니다.

## 개요

- 10개 팀 (가조 5팀 + 나조 5팀)이 3단계 미션을 수행
- Stage 1: 실내 미션 (관리자가 완료 기록)
- Stage 2: GPS 기반 실외 미션 (양림동 9개 장소 탐험)
- Stage 3: 최종 미션
- 벽시계(wall-clock) 기반 자동 Stage 전환

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Socket.io Client |
| Backend | Express 5, Socket.io, TypeScript |
| 지도 | Kakao Maps API |
| 배포 | Vercel (Frontend), Railway (Backend) |

## 프로젝트 구조

```
sinui-akdan/
├── client/                # 프론트엔드
│   ├── src/
│   │   ├── pages/         # Game.tsx, Admin.tsx, Landing.tsx
│   │   ├── components/    # MapView, LocationCard, Timer, HintCard
│   │   ├── hooks/         # useGPS, useTimer, useSocket
│   │   ├── data/          # gameData.ts (클라이언트 장소 데이터)
│   │   └── theme.ts       # 디자인 토큰
│   └── vercel.json        # Vercel SPA 설정
├── server/                # 백엔드
│   ├── index.ts           # Express + Socket.io 서버
│   ├── gameState.ts       # 게임 상태 관리
│   ├── gameData.ts        # 장소/경로 데이터 (9개 장소, 10팀 경로)
│   ├── gpsCheck.ts        # GPS 근접 판정 (해금 40m, 접근 100m)
│   ├── adminRoutes.ts     # 관리자 API
│   ├── persistence.ts     # data.json 파일 저장/불러오기
│   └── shared/types.ts    # 공유 타입
└── shared/                # 클라이언트-서버 공유
    └── types.ts           # 타입 정의, Stage 계산 함수
```

## 게임 흐름

### 팀 구성
- 가조 (팀 1~5): Stage 1 → Stage 2 → Stage 3
- 나조 (팀 6~10): Stage 2 → Stage 1 → Stage 3

### Stage 시간 (실전 모드)
- Stage 1: 30분
- Stage 2: 32분
- Stage 3: 30분

### Stage 2 미션 규칙
- 각 팀은 3개의 장소를 순서대로 찾아감
- 각 단계마다 정답 1곳 + 오답 1곳이 제시됨
- 팀원 4명 이상이 정답 장소 40m 이내에 모여야 해금
- 오답 장소 선택 시 이동 페널티 발생
- 3개 장소 모두 정답 시 Stage 2 자동 완료 기록

## 환경 변수

### Frontend (.env)
```
VITE_KAKAO_MAP_KEY=your_kakao_map_api_key
VITE_SERVER_URL=http://localhost:3001
```

### Backend
```
ADMIN_PASSWORD=admin2024
PORT=3001
```

## 로컬 개발

### 서버 실행
```bash
cd server
npm install
npm run dev
```

### 클라이언트 실행
```bash
cd client
npm install
npm run dev
```

개발 서버: http://localhost:5173
API 서버: http://localhost:3001

## 배포

### Frontend (Vercel)
- GitHub 연동 후 자동 배포
- Root Directory: `client`
- Build Command: `tsc -b && vite build`
- Output Directory: `dist`

### Backend (Railway)
- GitHub 연동 후 자동 배포
- Root Directory: `server`
- Build Command: `npm run build`
- Start Command: `npm start`

> 주의: 이벤트 진행 중에는 git push를 하지 마세요. Railway 재배포 시 게임 데이터(data.json)가 초기화됩니다.

## 관리자 페이지

`/admin` 경로로 접속하여 관리자 기능을 사용할 수 있습니다.

- 전체 게임 시작/리셋
- 테스트 모드 전환 (Stage별 1분)
- 팀별 실시간 상태 모니터링
- Stage 1 완료 수동 기록 및 소요 시간 표시
- Stage 2 완료 자동 기록 및 소요 시간 표시
- Stage 건너뛰기
- 팀별 채팅

## 양림동 미션 장소 (9곳)

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

## 라이선스

이 프로젝트는 광주 CCC 교회 D&I 행사 전용으로 제작되었습니다.
