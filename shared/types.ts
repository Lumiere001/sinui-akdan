// ========== 공유 타입 정의 ==========

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  unlockRadius: number;    // 해금 반경 (m)
  approachRadius: number;  // 접근 알림 반경 (m)
  hint: string;            // 장소 힌트 텍스트
}

export interface TeamConfig {
  teamId: number;
  visibleLocations: string[];
  correctLocation: string;
  hint: string;
  correctPhoto: string;
  wrongPhoto: string;
}

export interface RoundConfig {
  roundId: number;
  teams: Record<number, TeamConfig>;
}

export interface GameData {
  locations: Location[];
  rounds: Record<string, RoundConfig>;
}

export interface PlayerPosition {
  playerId: string;
  teamId: number;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface TeamState {
  teamId: number;
  members: Record<string, PlayerPosition>;
  unlockedLocation: string | null;
  scorePhoto: string | null;
}

export interface GameState {
  currentRound: number;       // 1 or 2
  isActive: boolean;
  startTime: number | null;
  duration: number;           // 30분 = 1800000ms
  teams: Record<number, TeamState>;
}

// Socket.io 이벤트 타입
export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:started': (data: { round: number; startTime: number }) => void;
  'game:stopped': () => void;
  'team:unlock': (data: { teamId: number; locationId: string; photo: string }) => void;
  'team:wrong': (data: { teamId: number; locationId: string }) => void;
  'team:memberCount': (data: { locationId: string; count: number; needed: number }) => void;
  'team:positions': (positions: PlayerPosition[]) => void;
  'admin:allPositions': (data: Record<number, PlayerPosition[]>) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { teamId: number; playerId: string }) => void;
  'player:position': (data: PlayerPosition) => void;
  'player:checkLocation': (data: { locationId: string }) => void;
  'admin:startRound': (round: number) => void;
  'admin:stopRound': () => void;
  'admin:resetGame': () => void;
}
