import type { GameState, PlayerPosition, TeamState } from './shared/types.js';

/**
 * Game state management - maintains in-memory state of the current game
 * Handles round progression, team tracking, and position updates
 */
class GameStateManager {
  private state: GameState;
  private roundDuration: number = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Create initial game state
   */
  private createInitialState(): GameState {
    return {
      currentRound: 1,
      isActive: false,
      startTime: null,
      duration: this.roundDuration,
      teams: this.initializeTeams(),
    };
  }

  /**
   * Initialize team state objects for all 10 teams
   */
  private initializeTeams(): Record<number, TeamState> {
    const teams: Record<number, TeamState> = {};
    for (let i = 1; i <= 10; i++) {
      teams[i] = {
        teamId: i,
        members: {},
        unlockedLocation: null,
        scorePhoto: null,
      };
    }
    return teams;
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Start a specific round
   * @param roundNumber - 1 or 2
   */
  startRound(roundNumber: 1 | 2): void {
    if (roundNumber !== 1 && roundNumber !== 2) {
      throw new Error('Round must be 1 or 2');
    }

    this.state.currentRound = roundNumber;
    this.state.isActive = true;
    this.state.startTime = Date.now();
    this.resetTeamProgress();
  }

  /**
   * Stop the current round
   */
  stopRound(): void {
    this.state.isActive = false;
    this.state.startTime = null;
  }

  /**
   * Reset game to initial state
   */
  resetGame(): void {
    this.state = this.createInitialState();
  }

  /**
   * Reset team progress (unlocked locations, photos)
   * Used when starting a new round
   */
  private resetTeamProgress(): void {
    Object.keys(this.state.teams).forEach((teamIdStr) => {
      const teamId = Number(teamIdStr) as keyof typeof this.state.teams;
      this.state.teams[teamId].unlockedLocation = null;
      this.state.teams[teamId].scorePhoto = null;
    });
  }

  /**
   * Get state for a specific team
   */
  getTeamState(teamId: number): TeamState {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    return JSON.parse(JSON.stringify(team));
  }

  /**
   * Update player position
   * @param teamId - Team ID
   * @param playerId - Player ID
   * @param lat - Latitude
   * @param lng - Longitude
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
  }

  /**
   * Add a player to a team
   * @param teamId - Team ID
   * @param playerId - Player ID
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
    }
  }

  /**
   * Remove a player from a team
   * @param teamId - Team ID
   * @param playerId - Player ID
   */
  removePlayerFromTeam(teamId: number, playerId: string): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    delete team.members[playerId];
  }

  /**
   * Get all members of a team with their positions
   */
  getTeamMembers(teamId: number): PlayerPosition[] {
    const team = this.state.teams[teamId];
    if (!team) {
      return [];
    }

    return Object.values(team.members);
  }

  /**
   * Set unlocked location for a team
   * @param teamId - Team ID
   * @param locationId - Location ID
   * @param photoPath - Path to score photo
   */
  unlockLocation(teamId: number, locationId: string, photoPath: string): void {
    const team = this.state.teams[teamId];
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    team.unlockedLocation = locationId;
    team.scorePhoto = photoPath;
  }

  /**
   * Check if a team has already unlocked a location
   */
  hasTeamUnlockedLocation(teamId: number): boolean {
    return this.state.teams[teamId]?.unlockedLocation !== null;
  }

  /**
   * Get game timer information
   */
  getTimerInfo(): { elapsed: number; remaining: number; isActive: boolean } {
    const elapsed = this.state.isActive && this.state.startTime
      ? Date.now() - this.state.startTime
      : 0;
    const remaining = Math.max(0, this.state.duration - elapsed);
    const isActive = this.state.isActive && remaining > 0;

    return { elapsed, remaining, isActive };
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();
