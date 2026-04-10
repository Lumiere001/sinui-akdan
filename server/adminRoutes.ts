import { Router, Request, Response } from 'express';
import { gameStateManager } from './gameState.js';
import { getTeamRoute, getAllLocations } from './gameData.js';
import { getCurrentStageInfo } from './shared/types.js';
import type { PlayerPosition } from './shared/types.js';

/**
 * V3 Admin REST API routes
 */

export const adminRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024';

function adminAuth(req: Request, res: Response, next: () => void) {
  const password = req.headers['x-admin-password'] as string;
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

adminRouter.use(adminAuth);

/**
 * GET /api/admin/state
 */
adminRouter.get('/state', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/teams
 */
adminRouter.get('/teams', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    const teamsData: Record<number, any> = {};

    Object.entries(state.teams).forEach(([teamIdStr, teamState]) => {
      const teamId = Number(teamIdStr);
      const members = Object.values(teamState.members) as PlayerPosition[];

      // V3: 벽시계 기반 stage info
      let stageInfo = null;
      if (teamState.startTime) {
        stageInfo = getCurrentStageInfo(teamState.startTime, teamState.group, state.durations);
      }

      teamsData[teamId] = {
        teamId,
        group: teamState.group,
        memberCount: members.length,
        members,
        currentStep: teamState.currentStep,
        completedSteps: teamState.completedSteps,
        stage2CompletedAt: teamState.stage2CompletedAt,
        stage1CompletedAt: teamState.stage1CompletedAt,
        stage2History: teamState.stage2History,
        representative: teamState.representative,
        startTime: teamState.startTime,
        stageInfo,
      };
    });

    res.json({
      teams: teamsData,
      totalTeams: 10,
      masterStartTime: state.masterStartTime,
      testMode: state.testMode,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/team/:teamId
 */
adminRouter.get('/team/:teamId', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);
    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }

    const state = gameStateManager.getState();
    const teamState = gameStateManager.getTeamState(teamId);
    if (!teamState) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const members = Object.values(teamState.members) as PlayerPosition[];
    const chatHistory = gameStateManager.getChatHistory(teamId);
    const teamRoute = getTeamRoute(teamId);

    let stageInfo = null;
    if (teamState.startTime) {
      stageInfo = getCurrentStageInfo(teamState.startTime, teamState.group, state.durations);
    }

    res.json({
      teamId,
      group: teamState.group,
      memberCount: members.length,
      members,
      currentStep: teamState.currentStep,
      completedSteps: teamState.completedSteps,
      stage1CompletedAt: teamState.stage1CompletedAt,
      stage2CompletedAt: teamState.stage2CompletedAt,
      stage2History: teamState.stage2History,
      stageInfo,
      representative: teamState.representative,
      teamRoute,
      chatHistory,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/master-start
 */
adminRouter.post('/master-start', (_req: Request, res: Response) => {
  try {
    gameStateManager.masterStart();
    res.json({ success: true, message: 'Master start executed', state: gameStateManager.getState() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/team/:teamId/record-stage1-complete
 */
adminRouter.post('/team/:teamId/record-stage1-complete', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);
    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }
    gameStateManager.recordStage1Complete(teamId);
    res.json({ success: true, message: `Stage 1 complete recorded for team ${teamId}` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/team/:teamId/skip-stage
 */
adminRouter.post('/team/:teamId/skip-stage', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);
    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }
    gameStateManager.skipStage(teamId);
    res.json({ success: true, message: `Stage skipped for team ${teamId}` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/toggle-test-mode
 */
adminRouter.post('/toggle-test-mode', (_req: Request, res: Response) => {
  try {
    gameStateManager.toggleTestMode();
    res.json({ success: true, state: gameStateManager.getState() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/team/:teamId/reset
 */
adminRouter.post('/team/:teamId/reset', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);
    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }
    gameStateManager.resetTeam(teamId);
    res.json({ success: true, message: `Team ${teamId} reset` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/reset
 */
adminRouter.post('/reset', (_req: Request, res: Response) => {
  try {
    gameStateManager.resetGame();
    res.json({ success: true, message: 'Game reset', state: gameStateManager.getState() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/pledges
 */
adminRouter.get('/pledges', (_req: Request, res: Response) => {
  try {
    const state = gameStateManager.getState();
    const pledgesByTeam: Record<number, any[]> = {};
    for (let teamId = 1; teamId <= 10; teamId++) pledgesByTeam[teamId] = [];
    Object.values(state.pledges).forEach((pledge) => {
      pledgesByTeam[pledge.teamId].push(pledge);
    });
    res.json({ totalPledges: Object.keys(state.pledges).length, byTeam: pledgesByTeam });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/chat
 */
adminRouter.get('/chat', (_req: Request, res: Response) => {
  try {
    res.json({ chatMessages: gameStateManager.getState().chatMessages });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/chat/:teamId
 */
adminRouter.get('/chat/:teamId', (req: Request, res: Response) => {
  try {
    const teamId = Number(req.params.teamId);
    if (teamId < 1 || teamId > 10) {
      res.status(400).json({ error: 'Invalid team ID' });
      return;
    }
    res.json({ teamId, messages: gameStateManager.getChatHistory(teamId) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/admin/game-config
 */
adminRouter.get('/game-config', (_req: Request, res: Response) => {
  try {
    const locations = getAllLocations();
    const teamRoutes: Record<number, any> = {};
    for (let teamId = 1; teamId <= 10; teamId++) {
      const route = getTeamRoute(teamId);
      if (route) teamRoutes[teamId] = route;
    }
    res.json({ locations, teamRoutes });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
