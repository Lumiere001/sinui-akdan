import { Router, Request, Response } from 'express';
import { gameStateManager } from './gameState.js';
import { getTeamRoute, getAllLocations } from './gameData.js';
import type { PlayerPosition } from './shared/types.js';

/**
 * Admin REST API routes for game management (V2)
 * Provides endpoints for managing per-team timers, pledges, chat, and game state
 */

export const adminRouter = Router();

// Admin authentication middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024';

function adminAuth(req: Request, res: Response, next: () => void) {
  const password = req.headers['x-admin-password'] as string;
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Apply auth to all admin routes
adminRouter.use(adminAuth);

/**
 * GET /api/admin/state
 * Returns the current game state including all teams, timers, pledges, and chat
 */
adminRouter.get('/state', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    res.json(state);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/teams
 * Returns all teams with their members, positions, step progress, and timer status
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
        currentStep: teamState.currentStep,
        completedSteps: teamState.completedSteps,
        isComplete: teamState.isComplete,
        timerStartTime: teamState.timerStartTime,
        timerDuration: teamState.timerDuration,
        isTimerActive: teamState.isTimerActive,
        isTimerExpired: teamState.isTimerExpired,
        representative: teamState.representative,
      };
    });

    res.json({
      teams: teamsData,
      totalTeams: 10,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/team/:teamId
 * Returns detailed state for a specific team
 */
adminRouter.get('/team/:teamId', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    const teamState = gameStateManager.getTeamState(teamId);
    if (!teamState) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const members = Object.values(teamState.members) as PlayerPosition[];
    const chatHistory = gameStateManager.getChatHistory(teamId);
    const teamRoute = getTeamRoute(teamId);

    res.json({
      teamId,
      memberCount: members.length,
      members,
      currentStep: teamState.currentStep,
      completedSteps: teamState.completedSteps,
      isComplete: teamState.isComplete,
      timerInfo: gameStateManager.getTeamTimerInfo(teamId),
      representative: teamState.representative,
      teamRoute,
      chatHistory,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/team/:teamId/start
 * Start timer for a specific team
 */
adminRouter.post('/team/:teamId/start', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    gameStateManager.startTeamTimer(teamId);

    res.json({
      success: true,
      message: `Timer started for team ${teamId}`,
      teamState: gameStateManager.getTeamState(teamId),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/team/:teamId/stop
 * Stop timer for a specific team
 */
adminRouter.post('/team/:teamId/stop', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    gameStateManager.stopTeamTimer(teamId);

    res.json({
      success: true,
      message: `Timer stopped for team ${teamId}`,
      teamState: gameStateManager.getTeamState(teamId),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/team/:teamId/reset
 * Reset a specific team
 */
adminRouter.post('/team/:teamId/reset', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    gameStateManager.resetTeam(teamId);

    res.json({
      success: true,
      message: `Team ${teamId} reset`,
      teamState: gameStateManager.getTeamState(teamId),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/reset
 * Reset the entire game
 */
adminRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    gameStateManager.resetGame();

    res.json({
      success: true,
      message: 'Game reset',
      state: gameStateManager.getState(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/pledges
 * Returns all pledges submitted
 */
adminRouter.get('/pledges', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    const pledgesByTeam: Record<number, any[]> = {};

    for (let teamId = 1; teamId <= 10; teamId++) {
      pledgesByTeam[teamId] = [];
    }

    Object.values(state.pledges).forEach((pledge) => {
      pledgesByTeam[pledge.teamId].push({
        playerId: pledge.playerId,
        teamId: pledge.teamId,
        completedAt: pledge.completedAt,
      });
    });

    res.json({
      totalPledges: Object.keys(state.pledges).length,
      byTeam: pledgesByTeam,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/chat
 * Returns chat messages for all teams
 */
adminRouter.get('/chat', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();

    res.json({
      chatMessages: state.chatMessages,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/chat/:teamId
 * Returns chat history for a specific team
 */
adminRouter.get('/chat/:teamId', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    const chatHistory = gameStateManager.getChatHistory(teamId);

    res.json({
      teamId,
      messages: chatHistory,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/game-config
 * Returns complete game configuration (locations and team routes)
 */
adminRouter.get('/game-config', (_req: Request, res: Response) => {
  try {
    const locations = getAllLocations();
    const teamRoutes: Record<number, any> = {};

    for (let teamId = 1; teamId <= 10; teamId++) {
      const route = getTeamRoute(teamId);
      if (route) {
        teamRoutes[teamId] = route;
      }
    }

    res.json({
      locations,
      teamRoutes,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/timer/:teamId
 * Returns timer information for a specific team
 */
adminRouter.get('/timer/:teamId', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);

    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    const timerInfo = gameStateManager.getTeamTimerInfo(teamId);

    res.json({
      teamId,
      ...timerInfo,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
