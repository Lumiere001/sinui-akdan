import { loadGameState, debouncedSaveGameState, resetDataFile, createInitialGameState } from './persistence.js';
import {
  getCurrentStageInfo,
  computeSkipOffset,
  DEFAULT_DURATIONS,
  TEST_DURATIONS,
} from './shared/types.js';
import type {
  GameState,
  TeamState,
  TeamGroup,
  TeamStage,
  PlayerPosition,
  PledgeRecord,
  ChatMessage,
  Stage2StepRecord,
} from './shared/types.js';

/**
 * V3 GameStateManager
 * - 벽시계 기반 자동 Stage 전환 (타이머 제거)
 * - Master Start로 전팀 동시 시작
 * - 가조/나조 교차 운영
 */
class GameStateManager {
  private state: GameState;

  constructor() {
    this.state = loadGameState();
    console.log('V3 Game state loaded from persistence');
  }

  /** Get current game state (deep copy) */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /** Save state to persistence */
  private saveState(): void {
    debouncedSaveGameState(this.state);
  }

  // ========== V3 Master Controls ==========

  /**
   * Master Start — 전팀 동시 시작
   * 모든 팀의 startTime을 현재 시각으로 설정하고 stage를 첫 번째 순서로 전환
   */
  masterStart(): void {
    const now = Date.now();
    this.state.masterStartTime = now;

    for (let i = 1; i <= 10; i++) {
      const team = this.state.teams[i];
      if (team) {
        team.startTime = now;
        // 첫 Stage 자동 결정
        const firstStage = team.group === '가조' ? 'stage1' : 'stage2';
        team.stage = firstStage;

        // 나조(Stage 2 먼저)는 currentStep을 1로 초기화
        if (firstStage === 'stage2') {
          team.currentStep = 1;
          team.completedSteps = [];
        }
      }
    }

    this.saveState();
    console.log(`[V3] Master Start at ${new Date(now).toLocaleTimeString()}`);
  }

  /**
   * 주기적 Stage 업데이트 — 벽시계 기반으로 각 팀의 현재 Stage 계산
   * 1초마다 호출하여 Stage 전환 감지
   * @returns 변경된 팀 ID 배열
   */
  updateStages(): number[] {
    const changedTeams: number[] = [];
    const now = Date.now();

    for (let i = 1; i <= 10; i++) {
      const team = this.state.teams[i];
      if (!team || !team.startTime || team.stage === 'idle') continue;

      const info = getCurrentStageInfo(team.startTime, team.group, this.state.durations, now);
      const newStage = info.stage;

      if (newStage !== team.stage) {
        const prevStage = team.stage;
        team.stage = newStage;

        // Stage 2 진입 시 currentStep 초기화 (아직 시작 안 했으면)
        if (newStage === 'stage2' && team.currentStep === 0) {
          team.currentStep = 1;
          team.completedSteps = [];
        }

        changedTeams.push(i);
        console.log(`[V3] Team ${i} stage: ${prevStage} → ${newStage}`);
      }
    }

    if (changedTeams.length > 0) {
      this.saveState();
    }

    return changedTeams;
  }

  /**
   * Stage 1 완료 수동 기록 (관리자)
   */
  recordStage1Complete(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.stage1CompletedAt = Date.now();
    this.saveState();
    console.log(`[V3] Team ${teamId} Stage 1 completed at ${new Date().toLocaleTimeString()}`);
  }

  /**
   * 다음 Stage 건너뛰기 — startTime 조정
   */
  skipStage(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team || !team.startTime) throw new Error(`Team ${teamId} not started`);

    const offset = computeSkipOffset(team.startTime, team.group, this.state.durations);
    if (offset > 0) {
      team.startTime -= offset;
      console.log(`[V3] Team ${teamId} skip: startTime adjusted by -${Math.round(offset / 1000)}s`);
      // 즉시 Stage 업데이트
      this.updateStages();
    }
    this.saveState();
  }

  /**
   * 시작 시각 조정 (비상용)
   * teamId가 없으면 전팀, 있으면 해당 팀만
   */
  adjustStartTime(offsetMs: number, teamId?: number): void {
    if (teamId) {
      const team = this.state.teams[teamId];
      if (team && team.startTime) {
        team.startTime += offsetMs;
        console.log(`[V3] Team ${teamId} startTime adjusted by ${offsetMs}ms`);
      }
    } else {
      // 전팀 조정
      for (let i = 1; i <= 10; i++) {
        const team = this.state.teams[i];
        if (team && team.startTime) {
          team.startTime += offsetMs;
        }
      }
      if (this.state.masterStartTime) {
        this.state.masterStartTime += offsetMs;
      }
      console.log(`[V3] All teams startTime adjusted by ${offsetMs}ms`);
    }
    this.updateStages();
    this.saveState();
  }

  /**
   * 테스트 모드 전환
   */
  toggleTestMode(): void {
    this.state.testMode = !this.state.testMode;
    this.state.durations = this.state.testMode
      ? { ...TEST_DURATIONS }
      : { ...DEFAULT_DURATIONS };
    console.log(`[V3] Test mode: ${this.state.testMode ? 'ON' : 'OFF'} (durations: ${JSON.stringify(this.state.durations)})`);
    this.saveState();
  }

  // ========== Stage 2 Step Management ==========

  /**
   * Stage 2 단계 전진 (정답 시)
   */
  advanceStep(teamId: number, locationId: string): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    // 정답 기록
    const record: Stage2StepRecord = {
      step: team.currentStep,
      locationId,
      isCorrect: true,
      timestamp: Date.now(),
    };
    team.stage2History.push(record);

    if (!team.completedSteps.includes(team.currentStep)) {
      team.completedSteps.push(team.currentStep);
    }

    if (team.currentStep < 3) {
      team.currentStep += 1;
    } else {
      // 3단계 모두 완료
      team.stage2CompletedAt = Date.now();
      console.log(`[V3] Team ${teamId} Stage 2 all steps completed!`);
    }

    this.saveState();
  }

  /**
   * Stage 2 오답 기록
   */
  recordWrongAnswer(teamId: number, locationId: string): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    const record: Stage2StepRecord = {
      step: team.currentStep,
      locationId,
      isCorrect: false,
      timestamp: Date.now(),
    };
    team.stage2History.push(record);
    this.saveState();
  }

  // ========== Pledge Management ==========

  addPledge(playerId: string, teamId: number): void {
    this.state.pledges[playerId] = {
      playerId,
      teamId,
      completedAt: Date.now(),
    };
    this.saveState();
  }

  removePledgesForTeam(teamId: number): void {
    const toRemove = Object.keys(this.state.pledges).filter(pid => pid.startsWith(`t${teamId}_`));
    for (const pid of toRemove) {
      delete this.state.pledges[pid];
    }
    if (toRemove.length > 0) this.saveState();
  }

  hasPledge(playerId: string): boolean {
    return playerId in this.state.pledges;
  }

  getPledge(playerId: string): PledgeRecord | null {
    return this.state.pledges[playerId] || null;
  }

  // ========== Chat Management ==========

  addChatMessage(teamId: number, senderId: string, senderName: string, message: string, isAdmin: boolean): ChatMessage {
    if (!this.state.chatMessages[teamId]) {
      this.state.chatMessages[teamId] = [];
    }

    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      teamId,
      senderId,
      senderName,
      message,
      timestamp: Date.now(),
      isAdmin,
    };

    this.state.chatMessages[teamId].push(chatMessage);
    this.saveState();
    return chatMessage;
  }

  getChatHistory(teamId: number): ChatMessage[] {
    return this.state.chatMessages[teamId] || [];
  }

  clearChatHistory(teamId: number): void {
    this.state.chatMessages[teamId] = [];
    this.saveState();
  }

  // ========== Representative Management ==========

  setRepresentative(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);
    team.representative = playerId;
    this.saveState();
  }

  getRepresentative(teamId: number): string | null {
    return this.state.teams[teamId]?.representative || null;
  }

  // ========== Player Position Management ==========

  updatePlayerPosition(teamId: number, playerId: string, lat: number, lng: number): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.members[playerId] = {
      playerId,
      teamId,
      lat,
      lng,
      timestamp: Date.now(),
    };
    this.saveState();
  }

  addPlayerToTeam(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    if (!team.members[playerId]) {
      team.members[playerId] = {
        playerId,
        teamId,
        lat: 0,
        lng: 0,
        timestamp: Date.now(),
      };
      this.saveState();
    }
  }

  removePlayerFromTeam(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) return;

    delete team.members[playerId];
    if (team.representative === playerId) {
      team.representative = null;
    }
    this.saveState();
  }

  getTeamMembers(teamId: number): PlayerPosition[] {
    const team = this.state.teams[teamId];
    if (!team) return [];
    return Object.values(team.members);
  }

  getTeamState(teamId: number): TeamState | null {
    const team = this.state.teams[teamId];
    if (!team) return null;
    return JSON.parse(JSON.stringify(team));
  }

  // ========== Game Reset ==========

  /**
   * 전체 게임 리셋
   */
  resetGame(): void {
    const freshState = createInitialGameState();
    this.state = freshState;
    resetDataFile();
    this.saveState();
    console.log('[V3] Game reset');
  }

  /**
   * 특정 팀 리셋
   */
  resetTeam(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) return;

    const group: TeamGroup = teamId <= 5 ? '가조' : '나조';
    team.stage = 'idle';
    team.group = group;
    team.startTime = null;
    team.members = {};
    team.representative = null;
    team.stage1CompletedAt = null;
    team.currentStep = 0;
    team.completedSteps = [];
    team.stage2CompletedAt = null;
    team.stage2History = [];

    this.saveState();
    console.log(`[V3] Team ${teamId} reset`);
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();
