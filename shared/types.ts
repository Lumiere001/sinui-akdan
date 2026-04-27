// ========== V3 공유 타입 정의 ==========
//
// 이 파일은 두 위치(root shared/types.ts 와 server/shared/types.ts)에 동일
// 사본으로 유지된다. server 의 Docker 빌드 컨텍스트(./server)가 root 의 shared
// 폴더에 접근할 수 없는 구조적 제약 때문이다. CI(.github/workflows/ci.yml)가
// 매 push 마다 두 파일이 일치하는지 diff 로 검사하므로, 이 파일을 수정하면
// 다른 사본도 같은 내용으로 함께 갱신해야 한다.

// Location information
export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  unlockRadius: number;    // 해금 반경 (m)
  approachRadius: number;  // 접근 알림 반경 (m)
}

// Single step in a multi-step route
export interface RouteStep {
  stepNumber: number;      // 1, 2, or 3
  hint: string;
  correctLocation: string; // Location ID
  wrongLocation: string;   // Location ID for wrong answer
  correctPhoto: string;    // Filename of correct answer photo
  wrongPhoto: string;      // Filename of wrong answer photo
}

// Team's complete route (3 steps)
export interface TeamRoute {
  teamId: number;
  steps: RouteStep[];
  finalPhoto: string;      // Final photo when all steps completed
}

// Player position tracking
export interface PlayerPosition {
  playerId: string;
  teamId: number;
  lat: number;
  lng: number;
  timestamp: number;
}

// ========== V3 핵심 타입 ==========

// 팀 그룹 (가조: 1~5, 나조: 6~10)
export type TeamGroup = '가조' | '나조';

// Stage 상태 — V3는 _ready 없음, 벽시계 기반 자동 전환
export type TeamStage = 'idle' | 'stage1' | 'stage2' | 'stage3' | 'finished';

// Stage 소요 시간 (ms) — 테스트 모드와 실전 모드용
export interface StageDurations {
  stage1: number;
  stage2: number;
  stage3: number;
}

export const DEFAULT_DURATIONS: StageDurations = {
  stage1: 30 * 60 * 1000,   // 30분
  stage2: 32 * 60 * 1000,   // 32분
  stage3: 30 * 60 * 1000,   // 30분
};

export const TEST_DURATIONS: StageDurations = {
  stage1: 1 * 60 * 1000,    // 1분
  stage2: 1 * 60 * 1000,    // 1분
  stage3: 1 * 60 * 1000,    // 1분
};

// Stage 2 GPS 미션 기록 (단계별 정답/오답)
export interface Stage2StepRecord {
  step: number;
  locationId: string;
  isCorrect: boolean;
  timestamp: number;
}

// ========== V3 팀 상태 ==========
export interface TeamState {
  teamId: number;
  group: TeamGroup;
  stage: TeamStage;
  startTime: number | null;                 // 이 팀의 게임 시작 시각 (보통 masterStartTime과 동일, 비상 조정 가능)
  members: Record<string, PlayerPosition>;
  representative: string | null;

  // Stage 1 (실내 방탈출)
  stage1CompletedAt: number | null;          // 관리자가 수동 기록한 완료 시각
  stage1ElapsedMs: number | null;            // Stage 1 소요 시간 (ms) — 완료 시 확정, 이후 불변

  // Stage 2 (실외 GPS 미션)
  currentStep: number;                       // 0=미시작, 1-3=진행 중
  completedSteps: number[];                  // 완료한 단계 배열
  stage2CompletedAt: number | null;          // 3단계 모두 정답 시 자동 기록
  stage2ElapsedMs: number | null;            // Stage 2 소요 시간 (ms) — 완료 시 확정, 이후 불변
  stage2History: Stage2StepRecord[];         // 단계별 시도 기록
}

// Pledge record
export interface PledgeRecord {
  playerId: string;
  teamId: number;
  completedAt: number;
}

// Chat message
export interface ChatMessage {
  id: string;
  teamId: number;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  isAdmin: boolean;
}

// ========== V3 게임 상태 ==========
export interface GameState {
  masterStartTime: number | null;            // Master Start 시각 (전역)
  testMode: boolean;                         // 테스트 모드 여부
  durations: StageDurations;                 // 현재 적용 중인 Stage 시간
  teams: Record<number, TeamState>;
  pledges: Record<string, PledgeRecord>;
  chatMessages: Record<number, ChatMessage[]>;
}

// ========== Stage 계산 헬퍼 ==========

/** 그룹별 Stage 진행 순서 */
export function getStageSequence(group: TeamGroup): ('stage1' | 'stage2' | 'stage3')[] {
  return group === '가조'
    ? ['stage1', 'stage2', 'stage3']
    : ['stage2', 'stage1', 'stage3'];
}

/** 현재 Stage 정보 계산 (벽시계 기반) */
export interface StageInfo {
  stage: TeamStage;
  stageElapsed: number;    // 현재 Stage 경과 시간 (ms)
  stageRemaining: number;  // 현재 Stage 남은 시간 (ms)
  stageIndex: number;      // 0, 1, 2 (진행 순서 내 인덱스)
  totalElapsed: number;    // 전체 경과 시간 (ms)
}

export function getCurrentStageInfo(
  startTime: number,
  group: TeamGroup,
  durations: StageDurations,
  now?: number,
): StageInfo {
  const currentTime = now ?? Date.now();
  const elapsed = currentTime - startTime;
  const sequence = getStageSequence(group);

  let cumulative = 0;
  for (let i = 0; i < sequence.length; i++) {
    const stageName = sequence[i];
    const duration = durations[stageName];
    if (elapsed < cumulative + duration) {
      return {
        stage: stageName,
        stageElapsed: elapsed - cumulative,
        stageRemaining: cumulative + duration - elapsed,
        stageIndex: i,
        totalElapsed: elapsed,
      };
    }
    cumulative += duration;
  }

  return { stage: 'finished', stageElapsed: 0, stageRemaining: 0, stageIndex: 3, totalElapsed: elapsed };
}

/** "다음 Stage로 건너뛰기" — startTime을 조정해서 현재 Stage가 즉시 끝나도록 */
export function computeSkipOffset(
  startTime: number,
  group: TeamGroup,
  durations: StageDurations,
  now?: number,
): number {
  const info = getCurrentStageInfo(startTime, group, durations, now);
  if (info.stage === 'finished') return 0;
  // startTime을 stageRemaining만큼 앞당기면 현재 Stage가 방금 끝난 것처럼 됨
  return info.stageRemaining;
}

// ========== Socket.io 이벤트 타입 ==========
export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'pledge:status': (data: { playerId: string; hasPledge: boolean }) => void;
  // Stage 2 GPS 미션 이벤트
  'team:stageUpdate': (data: { teamId: number; currentStep: number; hint: string; locations: { correctId: string; wrongId: string } }) => void;
  'team:stepComplete': (data: { teamId: number; stepNumber: number }) => void;
  'team:wrong': (data: { teamId: number; locationId: string }) => void;
  'team:stage2Complete': (data: { teamId: number }) => void;
  // 위치/접근
  'team:positions': (positions: PlayerPosition[]) => void;
  'team:memberCount': (data: { locationId: string; count: number; needed: number }) => void;
  // 채팅 (전 Stage, 대표만)
  'chat:message': (data: ChatMessage) => void;
  'chat:history': (data: ChatMessage[]) => void;
  'representative:status': (data: { teamId: number; representativeId: string | null; representativeName: string | null }) => void;
  // 관리자용
  'admin:allPositions': (data: Record<number, PlayerPosition[]>) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  // 참여자
  'player:join': (data: { teamId: number; playerId: string; playerName: string; password: string; isRepresentative: boolean }) => void;
  'player:position': (data: PlayerPosition) => void;
  'player:checkLocation': (data: { locationId: string }) => void;
  'pledge:submit': (data: { playerId: string; teamId: number }) => void;
  'pledge:check': (data: { playerId: string }) => void;
  'chat:send': (data: { teamId: number; message: string }) => void;
  // 관리자
  'admin:join': (password: string) => void;
  'admin:masterStart': () => void;                                      // 전팀 동시 시작
  'admin:recordStage1Complete': (teamId: number) => void;               // Stage 1 완료 수동 기록
  'admin:skipStage': (teamId: number) => void;                          // 다음 Stage 건너뛰기 (테스트/비상)
  'admin:forceAdvanceStep': (teamId: number) => void;                   // Stage 2 수동 해금
  'admin:adjustStartTime': (data: { teamId?: number; offsetMs: number }) => void; // 시작 시각 조정
  'admin:toggleTestMode': () => void;                                   // 테스트 모드 전환
  'admin:resetGame': () => void;
  'admin:resetTeam': (teamId: number) => void;
}
