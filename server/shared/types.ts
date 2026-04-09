// ========== V2 공유 타입 정의 ==========

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

// Stage type: 'idle' | 'stage1_ready' | 'stage1' | 'stage2_ready' | 'stage2'
export type TeamStage = 'idle' | 'stage1_ready' | 'stage1' | 'stage2_ready' | 'stage2';

// Team state during game
export interface TeamState {
  teamId: number;
  stage: TeamStage;                       // 현재 스테이지 상태
  members: Record<string, PlayerPosition>;
  // Stage 1 timer (40 minutes)
  stage1TimerStartTime: number | null;
  stage1TimerDuration: number;            // 40 minutes in ms
  stage1TimerActive: boolean;
  stage1TimerExpired: boolean;
  stage1TimerPaused: boolean;
  stage1TimerRemainingAtPause: number | null;
  // Stage 2 (existing fields)
  currentStep: number;                    // 0=not started, 1-3=current step, 4=completed
  completedSteps: number[];               // Array of completed step numbers
  isComplete: boolean;
  timerStartTime: number | null;          // When this team's timer started
  timerDuration: number;                  // 25 minutes in ms
  isTimerActive: boolean;
  isTimerExpired: boolean;
  isTimerPaused: boolean;                 // 일시정지 여부
  timerRemainingAtPause: number | null;   // 일시정지 시 남은 시간 (ms)
  representative: string | null;          // playerId of team representative
}

// Pledge record (player completes the final action)
export interface PledgeRecord {
  playerId: string;
  teamId: number;
  completedAt: number;                    // Timestamp
}

// Chat message for team-admin communication
export interface ChatMessage {
  id: string;
  teamId: number;
  senderId: string;                       // playerId
  senderName: string;
  message: string;
  timestamp: number;
  isAdmin: boolean;
}

// Complete game state
export interface GameState {
  teams: Record<number, TeamState>;
  pledges: Record<string, PledgeRecord>;  // Key: playerId
  chatMessages: Record<number, ChatMessage[]>; // Key: teamId
}

// Socket.io event types
export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'pledge:status': (data: { playerId: string; hasPledge: boolean }) => void;
  'team:stageChange': (data: { teamId: number; stage: TeamStage }) => void;
  'team:stageUpdate': (data: { teamId: number; currentStep: number; hint: string; locations: { correctId: string; wrongId: string } }) => void;
  'team:stepComplete': (data: { teamId: number; stepNumber: number; photo: string }) => void;
  'team:wrong': (data: { teamId: number; locationId: string; photo: string }) => void;
  'team:complete': (data: { teamId: number; photo: string }) => void;
  'team:timerStart': (data: { teamId: number; duration: number }) => void;
  'team:timerPaused': (data: { teamId: number; remaining: number }) => void;
  'team:timerResumed': (data: { teamId: number; duration: number }) => void;
  'team:timerExpired': (data: { teamId: number }) => void;
  'team:stage1TimerStart': (data: { teamId: number; duration: number }) => void;
  'team:stage1TimerPaused': (data: { teamId: number; remaining: number }) => void;
  'team:stage1TimerResumed': (data: { teamId: number; duration: number }) => void;
  'team:stage1TimerExpired': (data: { teamId: number }) => void;
  'team:positions': (positions: PlayerPosition[]) => void;
  'team:memberCount': (data: { locationId: string; count: number; needed: number }) => void;
  'chat:message': (data: ChatMessage) => void;
  'chat:history': (data: ChatMessage[]) => void;
  'representative:status': (data: { teamId: number; representativeId: string | null; representativeName: string | null }) => void;
  'admin:allPositions': (data: Record<number, PlayerPosition[]>) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { teamId: number; playerId: string; playerName: string; password: string; isRepresentative: boolean }) => void;
  'player:position': (data: PlayerPosition) => void;
  'player:checkLocation': (data: { locationId: string }) => void;
  'pledge:submit': (data: { playerId: string; teamId: number }) => void;
  'pledge:check': (data: { playerId: string }) => void;
  'chat:send': (data: { teamId: number; message: string }) => void;
  'admin:join': (password: string) => void;
  'admin:setStage': (data: { teamId: number; stage: TeamStage }) => void;
  'admin:startTimer': (teamId: number) => void;
  'admin:stopTimer': (teamId: number) => void;
  'admin:pauseTimer': (teamId: number) => void;
  'admin:resumeTimer': (teamId: number) => void;
  'admin:stage1StartTimer': (teamId: number) => void;
  'admin:stage1StopTimer': (teamId: number) => void;
  'admin:stage1PauseTimer': (teamId: number) => void;
  'admin:stage1ResumeTimer': (teamId: number) => void;
  'admin:resetGame': () => void;
  'admin:resetTeam': (teamId: number) => void;
}
