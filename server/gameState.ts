import { loadGameState, saveGameState, debouncedSaveGameState, resetDataFile } from './persistence.js';
import type { GameState, TeamState, TeamStage, PlayerPosition, PledgeRecord, ChatMessage } from './shared/types.js';

/**
 * Game state management for V2
 * - Per-team timers (30 minutes each)
 * - Multi-step routes (3 steps per team)
 * - Pledge system
 * - Chat system
 * - JSON persistence
 */
class GameStateManager {
  private state: GameState;

  constructor() {
    this.state = loadGameState();
    console.log('Game state loaded from persistence');
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Save state to persistence
   */
  private saveState(): void {
    debouncedSaveGameState(this.state);
  }

  // ========== Stage Management ==========

  /**
   * Set team stage
   */
  setTeamStage(teamId: number, stage: TeamStage): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    team.stage = stage;
    this.saveState();
  }

  // ========== Stage 1 Timer Management (40 minutes) ==========

  startStage1Timer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.stage = 'stage1';
    team.stage1TimerStartTime = Date.now();
    team.stage1TimerDuration = 40 * 60 * 1000;
    team.stage1TimerActive = true;
    team.stage1TimerExpired = false;
    team.stage1TimerPaused = false;
    team.stage1TimerRemainingAtPause = null;
    this.saveState();
  }

  stopStage1Timer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);

    team.stage1TimerActive = false;
    team.stage1TimerPaused = false;
    team.stage1TimerRemainingAtPause = null;
    this.saveState();
  }

  pauseStage1Timer(teamId: number): number {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);
    if (!team.stage1TimerActive || !team.stage1TimerStartTime) {
      throw new Error(`Team ${teamId} stage1 timer is not active`);
    }

    const elapsed = Date.now() - team.stage1TimerStartTime;
    const remaining = Math.max(0, team.stage1TimerDuration - elapsed);

    team.stage1TimerActive = false;
    team.stage1TimerPaused = true;
    team.stage1TimerRemainingAtPause = remaining;
    this.saveState();
    return remaining;
  }

  resumeStage1Timer(teamId: number): number {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);
    if (!team.stage1TimerPaused || team.stage1TimerRemainingAtPause === null) {
      throw new Error(`Team ${teamId} stage1 timer is not paused`);
    }

    const remaining = team.stage1TimerRemainingAtPause;
    team.stage1TimerStartTime = Date.now();
    team.stage1TimerDuration = remaining;
    team.stage1TimerActive = true;
    team.stage1TimerPaused = false;
    team.stage1TimerRemainingAtPause = null;
    this.saveState();
    return remaining;
  }

  isStage1TimerExpired(teamId: number): boolean {
    const team = this.state.teams[teamId];
    if (!team || !team.stage1TimerStartTime || !team.stage1TimerActive) return false;
    const elapsed = Date.now() - team.stage1TimerStartTime;
    return elapsed >= team.stage1TimerDuration;
  }

  expireStage1Timer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) throw new Error(`Team ${teamId} not found`);
    team.stage1TimerActive = false;
    team.stage1TimerExpired = true;
    this.saveState();
  }

  // ========== Stage 2 Timer Management (30 minutes) ==========

  /**
   * Start individual team timer
   */
  startTeamTimer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.timerStartTime = Date.now();
    team.timerDuration = 30 * 60 * 1000;
    team.isTimerActive = true;
    team.isTimerExpired = false;
    team.isTimerPaused = false;
    team.timerRemainingAtPause = null;
    team.currentStep = 1; // Start at step 1
    team.completedSteps = [];

    this.saveState();
  }

  /**
   * Stop individual team timer (full reset)
   */
  stopTeamTimer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.isTimerActive = false;
    team.isTimerPaused = false;
    team.timerRemainingAtPause = null;
    this.saveState();
  }

  /**
   * Pause individual team timer
   */
  pauseTeamTimer(teamId: number): number {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    if (!team.isTimerActive || !team.timerStartTime) {
      throw new Error(`Team ${teamId} timer is not active`);
    }

    const elapsed = Date.now() - team.timerStartTime;
    const remaining = Math.max(0, team.timerDuration - elapsed);

    team.isTimerActive = false;
    team.isTimerPaused = true;
    team.timerRemainingAtPause = remaining;
    this.saveState();

    return remaining;
  }

  /**
   * Resume individual team timer
   */
  resumeTeamTimer(teamId: number): number {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    if (!team.isTimerPaused || team.timerRemainingAtPause === null) {
      throw new Error(`Team ${teamId} timer is not paused`);
    }

    const remaining = team.timerRemainingAtPause;
    team.timerStartTime = Date.now();
    team.timerDuration = remaining;
    team.isTimerActive = true;
    team.isTimerPaused = false;
    team.timerRemainingAtPause = null;
    this.saveState();

    return remaining;
  }

  /**
   * Check if team timer has expired
   */
  isTeamTimerExpired(teamId: number): boolean {
    const team = this.state.teams[teamId];
    if (!team || !team.timerStartTime || !team.isTimerActive) {
      return false;
    }

    const elapsed = Date.now() - team.timerStartTime;
    return elapsed >= team.timerDuration;
  }

  /**
   * Mark team timer as expired
   */
  expireTeamTimer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.isTimerActive = false;
    team.isTimerExpired = true;
    this.saveState();
  }

  /**
   * Get timer info for a team
   */
  getTeamTimerInfo(teamId: number): { elapsed: number; remaining: number; isActive: boolean; isExpired: boolean } {
    const team = this.state.teams[teamId];
    if (!team || !team.timerStartTime) {
      return { elapsed: 0, remaining: team?.timerDuration || 0, isActive: false, isExpired: false };
    }

    const elapsed = Date.now() - team.timerStartTime;
    const remaining = Math.max(0, team.timerDuration - elapsed);

    return {
      elapsed,
      remaining,
      isActive: team.isTimerActive,
      isExpired: team.isTimerExpired,
    };
  }

  // ========== Step Management ==========

  /**
   * Advance team to next step
   */
  advanceStep(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    if (!team.completedSteps.includes(team.currentStep)) {
      team.completedSteps.push(team.currentStep);
    }

    if (team.currentStep < 3) {
      team.currentStep += 1;
    } else {
      this.completeTeam(teamId);
    }

    this.saveState();
  }

  /**
   * Mark team as complete
   */
  completeTeam(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.isComplete = true;
    team.currentStep = 4; // Mark as complete
    team.isTimerActive = false;

    this.saveState();
  }

  // ========== Pledge Management ==========

  /**
   * Add pledge record
   */
  addPledge(playerId: string, teamId: number): void {
    const pledgeKey = playerId;
    this.state.pledges[pledgeKey] = {
      playerId,
      teamId,
      completedAt: Date.now(),
    };

    this.saveState();
  }

  /**
   * Remove pledges for a specific team
   */
  removePledgesForTeam(teamId: number): void {
    const toRemove = Object.keys(this.state.pledges).filter(pid => pid.startsWith(`t${teamId}_`));
    for (const pid of toRemove) {
      delete this.state.pledges[pid];
    }
    if (toRemove.length > 0) this.saveState();
  }

  /**
   * Check if player has submitted pledge
   */
  hasPledge(playerId: string): boolean {
    return playerId in this.state.pledges;
  }

  /**
   * Get pledge record
   */
  getPledge(playerId: string): PledgeRecord | null {
    return this.state.pledges[playerId] || null;
  }

  // ========== Chat Management ==========

  /**
   * Add chat message
   */
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

  /**
   * Get chat history for a team
   */
  getChatHistory(teamId: number): ChatMessage[] {
    return this.state.chatMessages[teamId] || [];
  }

  /**
   * Clear chat history for a team
   */
  clearChatHistory(teamId: number): void {
    this.state.chatMessages[teamId] = [];
    this.saveState();
  }

  // ========== Representative Management ==========

  /**
   * Set team representative
   */
  setRepresentative(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.representative = playerId;
    this.saveState();
  }

  /**
   * Get team representative
   */
  getRepresentative(teamId: number): string | null {
    return this.state.teams[teamId]?.representative || null;
  }

  // ========== Player Position Management ==========

  /**
   * Update player position
   */
  updatePlayerPosition(teamId: number, playerId: string, lat: number, lng: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.members[playerId] = {
      playerId,
      teamId,
      lat,
      lng,
      timestamp: Date.now(),
    };

    this.saveState();
  }

  /**
   * Add player to team
   */
  addPlayerToTeam(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

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

  /**
   * Remove player from team
   */
  removePlayerFromTeam(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) {
      return;
    }

    delete team.members[playerId];

    // Clear representative if it was this player
    if (team.representative === playerId) {
      team.representative = null;
    }

    this.saveState();
  }

  /**
   * Get team members with positions
   */
  getTeamMembers(teamId: number): PlayerPosition[] {
    const team = this.state.teams[teamId];
    if (!team) {
      return [];
    }

    return Object.values(team.members);
  }

  /**
   * Get team state
   */
  getTeamState(teamId: number): TeamState | null {
    const team = this.state.teams[teamId];
    if (!team) {
      return null;
    }

    return JSON.parse(JSON.stringify(team));
  }

  // ========== Game Reset ==========

  /**
   * Reset entire game
   */
  resetGame(): void {
    const teams: Record<number, TeamState> = {};
    for (let i = 1; i <= 11; i++) {
      teams[i] = {
        teamId: i,
        stage: 'idle',
        members: {},
        stage1TimerStartTime: null,
        stage1TimerDuration: 40 * 60 * 1000,
        stage1TimerActive: false,
        stage1TimerExpired: false,
        stage1TimerPaused: false,
        stage1TimerRemainingAtPause: null,
        currentStep: 0,
        completedSteps: [],
        isComplete: false,
        timerStartTime: null,
        timerDuration: 30 * 60 * 1000,
        isTimerActive: false,
        isTimerExpired: false,
        isTimerPaused: false,
        timerRemainingAtPause: null,
        representative: null,
      };
    }

    this.state = {
      teams,
      pledges: {},
      chatMessages: {},
    };

    resetDataFile();
    this.saveState();
  }

  /**
   * Reset a specific team
   */
  resetTeam(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      return;
    }

    team.stage = 'idle';
    team.members = {};
    team.stage1TimerStartTime = null;
    team.stage1TimerDuration = 40 * 60 * 1000;
    team.stage1TimerActive = false;
    team.stage1TimerExpired = false;
    team.stage1TimerPaused = false;
    team.stage1TimerRemainingAtPause = null;
    team.currentStep = 0;
    team.completedSteps = [];
    team.isComplete = false;
    team.timerStartTime = null;
    team.timerDuration = 30 * 60 * 1000;
    team.isTimerActive = false;
    team.isTimerExpired = false;
    team.isTimerPaused = false;
    team.timerRemainingAtPause = null;
    team.representative = null;

    this.saveState();
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();
