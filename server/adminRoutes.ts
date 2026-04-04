import { Router, Request, Response } from 'express';
import { gameStateManager } from './gameState.js';
import { gameData } from './gameData.js';
import type { PlayerPosition } from './shared/types';

/**
 * Admin REST API routes for game management
 * Provides endpoints for starting/stopping rounds, resetting game,
 * and monitoring game state and team positions
 */

export const adminRouter = Router();

/**
 * GET /api/admin/state
 * Returns the current game state including all teams, players, and progress
 */
adminRouter.get('/state', (_req: Request, res: Response) => {
  const state = gameStateManager.getState();
  res.json(state);
});

/**
 * POST /api/admin/round/start
 * Start a specific round (1 or 2)
 * Body: { round: 1 | 2 }
 */
adminRouter.post('/round/start', (req: Request, res: Response) => {
  try {
    const { round } = req.body;

    if (round !== 1 && round !== 2) {
      res.status(400).json({ error: 'Round must be 1 or 2' });
      return;
    }

    gameStateManager.startRound(round);
    const state = gameStateManager.getState();

    res.json({
      success: true,
      message: `Round ${round} started`,
      state,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/round/stop
 * Stop the current round
 */
adminRouter.post('/round/stop', (_req: Request, res: Response) => {
  try {
    gameStateManager.stopRound();
    const state = gameStateManager.getState();

    res.json({
      success: true,
      message: 'Round stopped',
      state,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/reset
 * Reset the game to initial state
 */
adminRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    gameStateManager.resetGame();
    const state = gameStateManager.getState();

    res.json({
      success: true,
      message: 'Game reset',
      state,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/teams
 * Returns all teams with their members, positions, and unlock status
 */
adminRouter.get('/teams', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    const teamsData: Record<number, any> = {};

    Object.entries(state.teams).forEach(([teamIdStr, teamState]) => {
      const teamId = Number(teamIdStr);
      const members = Object.values(teamState.members) as PlayerPosition[];

      teamsData[teamId] = {
        teamId,
        memberCount: members.length,
        members,
        unlockedLocation: teamState.unlockedLocation,
        scorePhoto: teamState.scorePhoto,
      };
    });

    res.json({
      currentRound: state.currentRound,
      isActive: state.isActive,
      startTime: state.startTime,
      teams: teamsData,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/game-config
 * Returns complete game configuration (locations and team assignments for current round)
 */
adminRouter.get('/game-config', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    const roundConfig = gameData.rounds[state.currentRound.toString()];

    res.json({
      currentRound: state.currentRound,
      locations: gameData.locations,
      roundTeams: roundConfig.teams,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/timer
 * Returns timer information for the current round
 */
adminRouter.get('/timer', (_req: Request, res: Response) => {
  try {
    const timerInfo = gameStateManager.getTimerInfo();
    res.json(timerInfo);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
