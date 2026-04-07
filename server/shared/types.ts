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

// Team state during game
export interface TeamState {
  teamId: number;
  members: Record<string, PlayerPosition>;
  currentStep: number;                    // 0=not started, 1-3=current step, 4=completed
  completedSteps: number[];               // Array of completed step numbers
  isComplete: boolean;
  timerStartTime: number | null;          // When this team's timer started
  timerDuration: number;                  // 30 minutes in ms
  isTimerActive: boolean;
  isTimerExpired: boolean;
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
  'team:stageUpdate': (data: { teamId: number; currentStep: number; hint: string; locations: { correctId: string; wrongId: string } }) => void;
  'team:stepComplete': (data: { teamId: number; stepNumber: number; photo: string }) => void;
  'team:wrong': (data: { teamId: number; locationId: string; photo: string }) => void;
  'team:complete': (data: { teamId: number; photo: string }) => void;
  'team:timerStart': (data: { teamId: number; duration: number }) => void;
  'team:timerExpired': (data: { teamId: number }) => void;
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
  'admin:startTimer': (teamId: number) => void;
  'admin:stopTimer': (teamId: number) => void;
  'admin:resetGame': () => void;
}
