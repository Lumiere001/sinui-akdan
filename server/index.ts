import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { adminRouter } from './adminRoutes.js';
import { gameStateManager } from './gameState.js';
import { checkProximity, checkTeamPresence, isValidLocation } from './gpsCheck.js';
import { getTeamRoute, getLocation, getAllLocations, getTeamRound } from './gameData.js';
import { getCurrentStageInfo } from './shared/types.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerPosition,
} from './shared/types.js';

// ========== Configuration ==========
const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [CLIENT_URL, 'https://sinui-akdan.vercel.app', 'http://localhost:5173'];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024';

// Team passwords (server-side validation) — keep in sync with client/src/data/gameData.ts
const TEAM_PASSWORDS: Record<number, string> = {
  1: '3847',
  2: '5291',
  3: '7463',
  4: '1926',
  5: '8052',
  6: '4739',
  7: '6185',
  8: '2574',
  9: '9318',
  10: '5607',
};

// ========== Express App Setup ==========
const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Admin API routes
app.use('/api/admin', adminRouter);

// ========== Socket.io Setup ==========
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

/**
 * Track team members and their positions
 */
const teamConnections = new Map<string, { teamId: number; playerId: string; playerName: string }>();

/**
 * Get the set of currently online playerIds
 */
function getOnlinePlayerIds(): Set<string> {
  const online = new Set<string>();
  for (const conn of teamConnections.values()) {
    online.add(conn.playerId);
  }
  return online;
}

/**
 * Broadcast game state to all connected clients
 * Admin receives only online members; team players receive full state
 */
function broadcastGameState(): void {
  const state = gameStateManager.getState();

  // Send full state to team players
  for (let t = 1; t <= 10; t++) {
    io.to(`team:${t}`).emit('game:state', state);
  }

  // Send filtered state to admin (only online members)
  const onlineIds = getOnlinePlayerIds();
  const adminState = JSON.parse(JSON.stringify(state)) as typeof state;
  for (const [teamId, team] of Object.entries(adminState.teams)) {
    const filtered: Record<string, any> = {};
    for (const [pid, member] of Object.entries(team.members)) {
      if (onlineIds.has(pid)) filtered[pid] = member;
    }
    adminState.teams[Number(teamId)].members = filtered;
  }
  io.to('admin').emit('game:state', adminState);
}

/**
 * V3 Stage Check Interval — 매초 벽시계 기반 Stage 전환 감지
 */
const stageCheckInterval = setInterval(() => {
  const changedTeams = gameStateManager.updateStages();

  if (changedTeams.length > 0) {
    // Stage 전환된 팀들에 대해 처리
    for (const teamId of changedTeams) {
      const teamState = gameStateManager.getTeamState(teamId);
      if (!teamState) continue;

      // Stage 2 진입 시 첫 번째 힌트 전송
      if (teamState.stage === 'stage2' && teamState.currentStep === 1) {
        const teamRoute = getTeamRoute(teamId);
        if (teamRoute) {
          const firstStep = teamRoute.steps[0];
          io.to(`team:${teamId}`).emit('team:stageUpdate', {
            teamId,
            currentStep: 1,
            hint: firstStep.hint,
            locations: {
              correctId: firstStep.correctLocation,
              wrongId: firstStep.wrongLocation,
            },
          });
        }
      }
    }

    broadcastGameState();
  }
}, 1000);

// ========== Socket.io Connection Handler ==========
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ========== Player Events ==========

  /**
   * Player joins their team room
   */
  socket.on('player:join', (data) => {
    const { teamId, playerId, playerName, password, isRepresentative } = data;

    try {
      if (!teamId || !playerId || !playerName) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      if (password !== TEAM_PASSWORDS[teamId]) {
        socket.emit('error', { message: 'Invalid team password' });
        return;
      }

      // Track this connection
      teamConnections.set(socket.id, { teamId, playerId, playerName });

      // Add player to team in game state
      gameStateManager.addPlayerToTeam(teamId, playerId);

      // Set representative if requested
      if (isRepresentative) {
        gameStateManager.setRepresentative(teamId, playerId);
      }

      // Join team-specific room
      const teamRoom = `team:${teamId}`;
      socket.join(teamRoom);

      console.log(`[Team ${teamId}] Player ${playerId} (${playerName}) joined (${socket.id})`);

      // Send current game state
      socket.emit('game:state', gameStateManager.getState());

      // Send pledge status
      socket.emit('pledge:status', {
        playerId,
        hasPledge: gameStateManager.hasPledge(playerId),
      });

      // Send chat history for this team
      const chatHistory = gameStateManager.getChatHistory(teamId);
      socket.emit('chat:history', chatHistory);

      // Send representative status
      const rep = gameStateManager.getRepresentative(teamId);
      let repName: string | null = null;
      if (rep) {
        for (const conn of teamConnections.values()) {
          if (conn.playerId === rep) { repName = conn.playerName; break; }
        }
      }
      socket.emit('representative:status', {
        teamId,
        representativeId: rep,
        representativeName: repName,
      });

      // Stage 2 재접속 처리: 현재 Stage 2 진행 중이면 현재 힌트 전송
      const teamState = gameStateManager.getTeamState(teamId);
      if (teamState && teamState.stage === 'stage2' && teamState.currentStep >= 1 && teamState.currentStep <= 3) {
        const teamRoute = getTeamRoute(teamId);
        if (teamRoute) {
          const currentStepRoute = teamRoute.steps.find((s) => s.stepNumber === teamState.currentStep);
          if (currentStepRoute) {
            socket.emit('team:stageUpdate', {
              teamId,
              currentStep: teamState.currentStep,
              hint: currentStepRoute.hint,
              locations: {
                correctId: currentStepRoute.correctLocation,
                wrongId: currentStepRoute.wrongLocation,
              },
            });
          }
        }
      }

      // Notify team members
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));
      io.to(teamRoom).emit('team:memberCount', {
        locationId: '',
        count: gameStateManager.getTeamMembers(teamId).length,
        needed: 3,
      });

      broadcastGameState();
    } catch (error) {
      console.error('[Error] player:join:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Player updates their position
   */
  socket.on('player:position', (data: PlayerPosition) => {
    try {
      const { teamId, playerId, lat, lng } = data;

      gameStateManager.updatePlayerPosition(teamId, playerId, lat, lng);

      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));

      // Check member counts at current step locations
      const teamState = gameStateManager.getTeamState(teamId);
      if (teamState && teamState.stage === 'stage2' && teamState.currentStep >= 1 && teamState.currentStep <= 3) {
        const teamRoute = getTeamRoute(teamId);
        if (teamRoute) {
          const currentStepRoute = teamRoute.steps.find((s) => s.stepNumber === teamState.currentStep);
          if (currentStepRoute) {
            const correctPresence = checkTeamPresence(teamId, currentStepRoute.correctLocation, gameStateManager);
            io.to(teamRoom).emit('team:memberCount', {
              locationId: currentStepRoute.correctLocation,
              count: correctPresence.count,
              needed: correctPresence.needed,
            });

            const wrongPresence = checkTeamPresence(teamId, currentStepRoute.wrongLocation, gameStateManager);
            io.to(teamRoom).emit('team:memberCount', {
              locationId: currentStepRoute.wrongLocation,
              count: wrongPresence.count,
              needed: wrongPresence.needed,
            });
          }
        }
      }

      // Broadcast to admin (online members only)
      const onlineIds = getOnlinePlayerIds();
      const allTeamsData: Record<number, PlayerPosition[]> = {};
      for (let t = 1; t <= 10; t++) {
        allTeamsData[t] = gameStateManager.getTeamMembers(t).filter(m => onlineIds.has(m.playerId));
      }
      io.to('admin').emit('admin:allPositions', allTeamsData);
    } catch (error) {
      console.error('[Error] player:position:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Player checks if they're at the correct location
   * V3: Stage 2 진행 중인지 벽시계로 판단
   */
  socket.on('player:checkLocation', (data) => {
    try {
      const { locationId } = data;
      const connection = teamConnections.get(socket.id);

      if (!connection) {
        socket.emit('error', { message: 'Not in a team' });
        return;
      }

      const { teamId, playerId } = connection;

      if (!isValidLocation(locationId)) {
        socket.emit('error', { message: 'Invalid location' });
        return;
      }

      const teamState = gameStateManager.getTeamState(teamId);
      if (!teamState) {
        socket.emit('error', { message: 'Team not found' });
        return;
      }

      // V3: 벽시계 기반으로 현재 Stage 2인지 확인
      if (teamState.stage !== 'stage2') {
        socket.emit('error', { message: 'Team is not in Stage 2' });
        return;
      }

      // Stage 2 이미 모두 완료한 경우
      if (teamState.stage2CompletedAt) {
        socket.emit('error', { message: 'Team already completed Stage 2' });
        return;
      }

      if (teamState.currentStep < 1 || teamState.currentStep > 3) {
        socket.emit('error', { message: 'Invalid step' });
        return;
      }

      // Get current step route
      const teamRoute = getTeamRoute(teamId);
      if (!teamRoute) {
        socket.emit('error', { message: 'Team route not found' });
        return;
      }

      const currentStepRoute = teamRoute.steps.find((s) => s.stepNumber === teamState.currentStep);
      if (!currentStepRoute) {
        socket.emit('error', { message: 'Current step not found' });
        return;
      }

      // Check team presence at location
      const presenceResult = checkTeamPresence(teamId, locationId, gameStateManager);

      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:memberCount', {
        locationId,
        count: presenceResult.count,
        needed: presenceResult.needed,
      });

      if (!presenceResult.sufficient) {
        console.log(`[Team ${teamId}] Insufficient members at ${locationId} (${presenceResult.count}/${presenceResult.needed})`);
        socket.emit('error', { message: `팀원이 더 모여야 합니다 (현재 ${presenceResult.count}명/${presenceResult.needed}명)` });
        return;
      }

      // Get player's current position
      const teamMembers = gameStateManager.getTeamMembers(teamId);
      const player = teamMembers.find((m) => m.playerId === playerId);

      if (!player) {
        socket.emit('error', { message: 'Player position not found' });
        return;
      }

      const location = getLocation(locationId);
      if (!location) {
        socket.emit('error', { message: 'Location not found' });
        return;
      }

      const proximity = checkProximity(player, location);
      if (proximity !== 'inside') {
        socket.emit('error', { message: `Not close enough to location (${proximity})` });
        return;
      }

      // Check if location is correct
      const isCorrect = locationId === currentStepRoute.correctLocation;

      if (isCorrect) {
        console.log(`[Team ${teamId}] Step ${teamState.currentStep} completed - Location ${locationId}`);

        io.to(teamRoom).emit('team:stepComplete', {
          teamId,
          stepNumber: teamState.currentStep,
        });

        // Advance step (with history recording)
        gameStateManager.advanceStep(teamId, locationId);

        const updatedTeamState = gameStateManager.getTeamState(teamId);
        if (updatedTeamState?.stage2CompletedAt) {
          // All 3 steps done
          io.to(teamRoom).emit('team:stage2Complete', { teamId });
          console.log(`[Team ${teamId}] Stage 2 completed!`);
        } else {
          // Send next step hint
          const nextStep = teamRoute.steps.find((s) => s.stepNumber === updatedTeamState?.currentStep);
          if (nextStep) {
            io.to(teamRoom).emit('team:stageUpdate', {
              teamId,
              currentStep: updatedTeamState?.currentStep || 0,
              hint: nextStep.hint,
              locations: {
                correctId: nextStep.correctLocation,
                wrongId: nextStep.wrongLocation,
              },
            });
          }
        }

        broadcastGameState();
      } else {
        // Wrong location
        console.log(`[Team ${teamId}] Wrong location ${locationId} (correct: ${currentStepRoute.correctLocation})`);

        gameStateManager.recordWrongAnswer(teamId, locationId);

        io.to(teamRoom).emit('team:wrong', {
          teamId,
          locationId,
        });
      }
    } catch (error) {
      console.error('[Error] player:checkLocation:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========== Pledge Events ==========

  socket.on('pledge:submit', (data) => {
    try {
      const { playerId, teamId } = data;
      gameStateManager.addPledge(playerId, teamId);

      socket.emit('pledge:status', { playerId, hasPledge: true });
      io.to('admin').emit('pledge:status', { playerId, hasPledge: true });

      console.log(`[Pledge] Player ${playerId} submitted pledge for team ${teamId}`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] pledge:submit:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  socket.on('pledge:check', (data) => {
    try {
      const { playerId } = data;
      socket.emit('pledge:status', { playerId, hasPledge: gameStateManager.hasPledge(playerId) });
    } catch (error) {
      console.error('[Error] pledge:check:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ========== Chat Events ==========

  socket.on('chat:send', (data) => {
    try {
      const { teamId, message } = data;
      const isAdmin = socket.rooms.has('admin');

      if (isAdmin) {
        const chatMessage = gameStateManager.addChatMessage(teamId, 'admin', '관리자', message, true);
        io.to(`team:${teamId}`).emit('chat:message', chatMessage);
        io.to('admin').emit('chat:message', chatMessage);
        console.log(`[Chat] Admin → Team ${teamId}: ${message}`);
      } else {
        const connection = teamConnections.get(socket.id);
        if (!connection) {
          socket.emit('error', { message: 'Not in a team' });
          return;
        }

        const senderTeamId = connection.teamId;

        // V3: 대표만 채팅 가능 (모든 Stage에서)
        const representative = gameStateManager.getRepresentative(senderTeamId);
        if (representative !== connection.playerId) {
          socket.emit('error', { message: 'Only team representative can send messages' });
          return;
        }

        const chatMessage = gameStateManager.addChatMessage(
          senderTeamId,
          connection.playerId,
          connection.playerName,
          message,
          false,
        );

        io.to(`team:${senderTeamId}`).emit('chat:message', chatMessage);
        io.to('admin').emit('chat:message', chatMessage);
        console.log(`[Chat] Team ${senderTeamId} - ${connection.playerName}: ${message}`);
      }
    } catch (error) {
      console.error('[Error] chat:send:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ========== Admin Events ==========

  /**
   * Admin joins the admin room
   */
  socket.on('admin:join', (password: string) => {
    try {
      if (password !== ADMIN_PASSWORD) {
        socket.emit('error', { message: 'Invalid admin password' });
        return;
      }

      socket.join('admin');
      console.log(`[Admin] Admin client joined (${socket.id})`);

      socket.emit('game:state', gameStateManager.getState());

      const allTeamsData: Record<number, PlayerPosition[]> = {};
      for (let t = 1; t <= 10; t++) {
        allTeamsData[t] = gameStateManager.getTeamMembers(t);
      }
      socket.emit('admin:allPositions', allTeamsData);

      for (let t = 1; t <= 10; t++) {
        const chatHistory = gameStateManager.getChatHistory(t);
        if (chatHistory.length > 0) {
          socket.emit('chat:history', chatHistory);
        }
      }
    } catch (error) {
      console.error('[Error] admin:join:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: Master Start — 전팀 동시 시작
   */
  socket.on('admin:masterStart', () => {
    try {
      gameStateManager.masterStart();

      // Stage 2로 시작하는 나조 팀들에게 첫 힌트 전송
      for (let i = 6; i <= 10; i++) {
        const teamRoute = getTeamRoute(i);
        if (teamRoute) {
          const firstStep = teamRoute.steps[0];
          io.to(`team:${i}`).emit('team:stageUpdate', {
            teamId: i,
            currentStep: 1,
            hint: firstStep.hint,
            locations: {
              correctId: firstStep.correctLocation,
              wrongId: firstStep.wrongLocation,
            },
          });
        }
      }

      console.log('[Admin] Master Start executed');
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:masterStart:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: Stage 1 완료 수동 기록
   */
  socket.on('admin:recordStage1Complete', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }
      gameStateManager.recordStage1Complete(teamId);
      console.log(`[Admin] Team ${teamId} Stage 1 completion recorded`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:recordStage1Complete:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: Stage 2 관리자 수동 해금 (출입 불가 등 긴급 상황)
   */
  socket.on('admin:forceAdvanceStep', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }
      const teamState = gameStateManager.getTeamState(teamId);
      if (!teamState) {
        socket.emit('error', { message: `Team ${teamId} not found` });
        return;
      }
      if (teamState.stage !== 'stage2') {
        socket.emit('error', { message: `Team ${teamId}은 현재 Stage 2가 아닙니다` });
        return;
      }
      if (teamState.stage2CompletedAt) {
        socket.emit('error', { message: `Team ${teamId}은 이미 Stage 2를 완료했습니다` });
        return;
      }
      if (teamState.currentStep < 1 || teamState.currentStep > 3) {
        socket.emit('error', { message: `Team ${teamId}의 현재 단계가 유효하지 않습니다` });
        return;
      }

      // 현재 단계의 정답 장소로 해금 처리
      const teamRoute = getTeamRoute(teamId);
      const currentStepRoute = teamRoute?.steps.find(s => s.stepNumber === teamState.currentStep);
      const locationId = currentStepRoute?.correctLocation || 'admin-force';

      gameStateManager.advanceStep(teamId, locationId);
      console.log(`[Admin] Team ${teamId} Step ${teamState.currentStep} force-advanced`);

      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:stepComplete', { teamId, stepNumber: teamState.currentStep });

      const updatedTeamState = gameStateManager.getTeamState(teamId);
      if (updatedTeamState?.stage2CompletedAt) {
        io.to(teamRoom).emit('team:stage2Complete', { teamId });
      } else if (updatedTeamState) {
        const nextRoute = teamRoute?.steps.find(s => s.stepNumber === updatedTeamState.currentStep);
        if (nextRoute) {
          io.to(teamRoom).emit('team:stageUpdate', {
            teamId,
            currentStep: updatedTeamState.currentStep,
            hint: nextRoute.hint,
            locations: {
              correctId: nextRoute.correctLocation,
              wrongId: nextRoute.wrongLocation,
            },
          });
        }
      }

      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:forceAdvanceStep:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: 다음 Stage 건너뛰기
   */
  socket.on('admin:skipStage', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }
      gameStateManager.skipStage(teamId);

      // Stage 2 진입 시 힌트 전송
      const teamState = gameStateManager.getTeamState(teamId);
      if (teamState && teamState.stage === 'stage2' && teamState.currentStep >= 1) {
        const teamRoute = getTeamRoute(teamId);
        if (teamRoute) {
          const step = teamRoute.steps.find((s) => s.stepNumber === teamState.currentStep);
          if (step) {
            io.to(`team:${teamId}`).emit('team:stageUpdate', {
              teamId,
              currentStep: teamState.currentStep,
              hint: step.hint,
              locations: {
                correctId: step.correctLocation,
                wrongId: step.wrongLocation,
              },
            });
          }
        }
      }

      console.log(`[Admin] Team ${teamId} stage skipped`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:skipStage:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: 시작 시각 조정
   */
  socket.on('admin:adjustStartTime', (data: { teamId?: number; offsetMs: number }) => {
    try {
      gameStateManager.adjustStartTime(data.offsetMs, data.teamId);
      console.log(`[Admin] StartTime adjusted: team=${data.teamId || 'all'}, offset=${data.offsetMs}ms`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:adjustStartTime:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * V3: 테스트 모드 전환
   */
  socket.on('admin:toggleTestMode', () => {
    try {
      gameStateManager.toggleTestMode();
      console.log('[Admin] Test mode toggled');
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:toggleTestMode:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * Admin resets the entire game
   */
  socket.on('admin:resetGame', () => {
    try {
      gameStateManager.resetGame();

      // 팀 소켓 연결 해제: 팀룸에서 제거하여 좀비 커넥션 방지
      teamConnections.forEach((value, socketId) => {
        const teamSocket = io.sockets.sockets.get(socketId);
        if (teamSocket) {
          teamSocket.leave(`team:${value.teamId}`);
        }
      });
      teamConnections.clear();

      io.emit('game:state', gameStateManager.getState());
      console.log('[Admin] Game reset');
    } catch (error) {
      console.error('[Error] admin:resetGame:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  /**
   * Admin resets a specific team
   */
  socket.on('admin:resetTeam', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      gameStateManager.resetTeam(teamId);

      const socketsToRemove: string[] = [];
      teamConnections.forEach((value, key) => {
        if (value.teamId === teamId) {
          socketsToRemove.push(key);
        }
      });
      for (const socketId of socketsToRemove) {
        teamConnections.delete(socketId);
      }

      gameStateManager.removePledgesForTeam(teamId);
      broadcastGameState();
      console.log(`[Admin] Team ${teamId} reset`);
    } catch (error) {
      console.error('[Error] admin:resetTeam:', error);
      socket.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ========== Disconnection Handler ==========
  socket.on('disconnect', () => {
    const connection = teamConnections.get(socket.id);

    if (connection) {
      const { teamId, playerId } = connection;
      teamConnections.delete(socket.id);
      console.log(`[Team ${teamId}] Player ${playerId} disconnected (position preserved)`);
      broadcastGameState();
    } else {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    }
  });
});

// ========== Server Startup ==========
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`신의 악단 (God's Orchestra) V3 Server`);
  console.log(`========================================`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`Socket.io: ws://localhost:${PORT}`);
  console.log(`========================================`);
});

// Cleanup on shutdown
process.on('SIGINT', () => {
  clearInterval(stageCheckInterval);
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

export { app, server, io };
