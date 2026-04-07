import { loadGameState, saveGameState, debouncedSaveGameState, resetDataFile } from './persistence.js';
import type { GameState, TeamState, PlayerPosition, PledgeRecord, ChatMessage } from './shared/types.js';

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

  // ========== Timer Management ==========

  /**
   * Start individual team timer
   */
  startTeamTimer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.timerStartTime = Date.now();
    team.isTimerActive = true;
    team.isTimerExpired = false;
    team.currentStep = 1; // Start at step 1
    team.completedSteps = [];

    this.saveState();
  }

  /**
   * Stop individual team timer
   */
  stopTeamTimer(teamId: number): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.isTimerActive = false;
    this.saveState();
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
    for (let i = 1; i <= 10; i++) {
      teams[i] = {
        teamId: i,
        members: {},
        currentStep: 0,
        completedSteps: [],
        isComplete: false,
        timerStartTime: null,
        timerDuration: 30 * 60 * 1000,
        isTimerActive: false,
        isTimerExpired: false,
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

    team.members = {};
    team.currentStep = 0;
    team.completedSteps = [];
    team.isComplete = false;
    team.timerStartTime = null;
    team.isTimerActive = false;
    team.isTimerExpired = false;
    team.representative = null;

    this.saveState();
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();
