import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { adminRouter } from './adminRoutes.js';
import { gameStateManager } from './gameState.js';
import { checkProximity, checkTeamPresence, isValidLocation } from './gpsCheck.js';
import { getTeamRoute, getLocation, getAllLocations, getTeamRound } from './gameData.js';
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

// Team passwords (server-side validation)
const TEAM_PASSWORDS: Record<number, string> = {
  1: '1111', 2: '2222', 3: '3333', 4: '4444', 5: '5555',
  6: '6666', 7: '7777', 8: '8888', 9: '9999', 10: '0000',
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
 * Broadcast game state to all connected clients
 */
function broadcastGameState(): void {
  const state = gameStateManager.getState();
  io.emit('game:state', state);
}

/**
 * Track team members and their positions
 */
const teamConnections = new Map<string, { teamId: number; playerId: string; playerName: string }>();

/**
 * Timer check interval - check every 1 second if any team timers have expired
 */
const timerCheckInterval = setInterval(() => {
  for (let teamId = 1; teamId <= 10; teamId++) {
    if (gameStateManager.isTeamTimerExpired(teamId)) {
      gameStateManager.expireTeamTimer(teamId);
      io.to(`team:${teamId}`).emit('team:timerExpired', { teamId });
      console.log(`[Timer] Team ${teamId} timer expired`);
    }
  }
}, 1000);

// ========== Socket.io Connection Handler ==========
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ========== Player Events ==========

  /**
   * Player joins their team room
   * Event: player:join
   * Data: { teamId, playerId, playerName, password, isRepresentative }
   */
  socket.on('player:join', (data) => {
    const { teamId, playerId, playerName, password, isRepresentative } = data;

    try {
      if (!teamId || !playerId || !playerName) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Validate team ID (1-10)
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      // Validate team password
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

      // If team is mid-game, send current step info (for reconnection)
      const teamState = gameStateManager.getTeamState(teamId);
      if (teamState && teamState.currentStep > 0 && teamState.currentStep <= 3 && teamState.isTimerActive) {
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
        // Also send timer info
        socket.emit('team:timerStart', {
          teamId,
          duration: teamState.timerDuration,
        });
      }

      // Notify team members about new join
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));
      io.to(teamRoom).emit('team:memberCount', {
        locationId: '',
        count: gameStateManager.getTeamMembers(teamId).length,
        needed: 3,
      });

      // Broadcast to admin
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
   * Event: player:position
   * Data: PlayerPosition
   */
  socket.on('player:position', (data: PlayerPosition) => {
    try {
      const { teamId, playerId, lat, lng } = data;

      // Update position in game state
      gameStateManager.updatePlayerPosition(teamId, playerId, lat, lng);

      // Broadcast updated positions to team members
      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));

      // Check and broadcast member counts at visible locations
      const teamState = gameStateManager.getTeamState(teamId);
      if (teamState && teamState.currentStep > 0 && teamState.currentStep <= 3) {
        const teamRoute = getTeamRoute(teamId);
        if (teamRoute) {
          const currentStepRoute = teamRoute.steps.find((s) => s.stepNumber === teamState.currentStep);
          if (currentStepRoute) {
            // Check member count at correct location
            const correctPresence = checkTeamPresence(teamId, currentStepRoute.correctLocation, gameStateManager);
            io.to(teamRoom).emit('team:memberCount', {
              locationId: currentStepRoute.correctLocation,
              count: correctPresence.count,
              needed: correctPresence.needed,
            });

            // Check member count at wrong location
            const wrongPresence = checkTeamPresence(teamId, currentStepRoute.wrongLocation, gameStateManager);
            io.to(teamRoom).emit('team:memberCount', {
              locationId: currentStepRoute.wrongLocation,
              count: wrongPresence.count,
              needed: wrongPresence.needed,
            });
          }
        }
      }

      // Broadcast to admin
      const allTeamsData: Record<number, PlayerPosition[]> = {};
      for (let t = 1; t <= 10; t++) {
        allTeamsData[t] = gameStateManager.getTeamMembers(t);
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
   * Event: player:checkLocation
   * Data: { locationId }
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

      // Validate location exists
      if (!isValidLocation(locationId)) {
        socket.emit('error', { message: 'Invalid location' });
        return;
      }

      // Get team state
      const teamState = gameStateManager.getTeamState(teamId);
      if (!teamState) {
        socket.emit('error', { message: 'Team not found' });
        return;
      }

      // Check if team has active timer
      if (!teamState.isTimerActive) {
        socket.emit('error', { message: 'Team timer is not active' });
        return;
      }

      // Check if team is already complete
      if (teamState.isComplete) {
        socket.emit('error', { message: 'Team already completed all steps' });
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

      // Broadcast member count to team
      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:memberCount', {
        locationId,
        count: presenceResult.count,
        needed: presenceResult.needed,
      });

      // If not enough team members present, stop here
      if (!presenceResult.sufficient) {
        console.log(
          `[Team ${teamId}] Insufficient members at location ${locationId} (${presenceResult.count}/${presenceResult.needed})`,
        );
        return;
      }

      // Get player's current position
      const teamMembers = gameStateManager.getTeamMembers(teamId);
      const player = teamMembers.find((m) => m.playerId === playerId);

      if (!player) {
        socket.emit('error', { message: 'Player position not found' });
        return;
      }

      // Check proximity to location
      const location = getLocation(locationId);
      if (!location) {
        socket.emit('error', { message: 'Location not found' });
        return;
      }

      const proximity = checkProximity(player, location);

      // Proximity check must be 'inside' to proceed
      if (proximity !== 'inside') {
        socket.emit('error', {
          message: `Not close enough to location (${proximity})`,
        });
        return;
      }

      // Check if location is correct for this step
      const isCorrect = locationId === currentStepRoute.correctLocation;

      if (isCorrect) {
        // Correct location found!
        console.log(
          `[Team ${teamId}] Step ${teamState.currentStep} completed - Location ${locationId}`,
        );

        // Broadcast step completion
        io.to(teamRoom).emit('team:stepComplete', {
          teamId,
          stepNumber: teamState.currentStep,
          photo: currentStepRoute.correctPhoto,
        });

        // Advance to next step or mark complete
        gameStateManager.advanceStep(teamId);

        // Check if team completed all steps
        const updatedTeamState = gameStateManager.getTeamState(teamId);
        if (updatedTeamState?.isComplete) {
          io.to(teamRoom).emit('team:complete', {
            teamId,
            photo: teamRoute.finalPhoto,
          });
          console.log(`[Team ${teamId}] Completed all steps!`);
        } else {
          // Send new step hint
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

        // Broadcast to admin
        broadcastGameState();
      } else {
        // Wrong location
        console.log(
          `[Team ${teamId}] Wrong location ${locationId} (correct: ${currentStepRoute.correctLocation})`,
        );

        io.to(teamRoom).emit('team:wrong', {
          teamId,
          locationId,
          photo: currentStepRoute.wrongPhoto,
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

  /**
   * Player submits pledge
   * Event: pledge:submit
   * Data: { playerId, teamId }
   */
  socket.on('pledge:submit', (data) => {
    try {
      const { playerId, teamId } = data;

      gameStateManager.addPledge(playerId, teamId);

      socket.emit('pledge:status', {
        playerId,
        hasPledge: true,
      });

      io.to('admin').emit('pledge:status', {
        playerId,
        hasPledge: true,
      });

      console.log(`[Pledge] Player ${playerId} submitted pledge for team ${teamId}`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] pledge:submit:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Check pledge status
   * Event: pledge:check
   * Data: { playerId }
   */
  socket.on('pledge:check', (data) => {
    try {
      const { playerId } = data;
      const hasPledge = gameStateManager.hasPledge(playerId);

      socket.emit('pledge:status', {
        playerId,
        hasPledge,
      });
    } catch (error) {
      console.error('[Error] pledge:check:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========== Chat Events ==========

  /**
   * Send chat message (team representative or admin)
   * Event: chat:send
   * Data: { teamId, message }
   */
  socket.on('chat:send', (data) => {
    try {
      const { teamId, message } = data;

      // Check if sender is admin
      const isAdmin = socket.rooms.has('admin');

      if (isAdmin) {
        // Admin sending message to a team
        const chatMessage = gameStateManager.addChatMessage(
          teamId,
          'admin',
          '관리자',
          message,
          true,
        );

        // Broadcast to team room and admin room
        io.to(`team:${teamId}`).emit('chat:message', chatMessage);
        io.to('admin').emit('chat:message', chatMessage);

        console.log(`[Chat] Admin → Team ${teamId}: ${message}`);
      } else {
        // Team member sending
        const connection = teamConnections.get(socket.id);

        if (!connection) {
          socket.emit('error', { message: 'Not in a team' });
          return;
        }

        // Use connection's teamId (not from client data) for security
        const senderTeamId = connection.teamId;

        // Only representative can send messages
        const representative = gameStateManager.getRepresentative(senderTeamId);
        if (representative !== connection.playerId) {
          socket.emit('error', { message: 'Only team representative can send messages' });
          return;
        }

        // Add message to chat
        const chatMessage = gameStateManager.addChatMessage(
          senderTeamId,
          connection.playerId,
          connection.playerName,
          message,
          false,
        );

        // Broadcast to team room and admin
        io.to(`team:${senderTeamId}`).emit('chat:message', chatMessage);
        io.to('admin').emit('chat:message', chatMessage);

        console.log(`[Chat] Team ${senderTeamId} - ${connection.playerName}: ${message}`);
      }
    } catch (error) {
      console.error('[Error] chat:send:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========== Admin Events ==========

  /**
   * Admin joins the admin room
   * Event: admin:join
   * Data: password
   */
  socket.on('admin:join', (password: string) => {
    try {
      if (password !== ADMIN_PASSWORD) {
        socket.emit('error', { message: 'Invalid admin password' });
        return;
      }

      socket.join('admin');
      console.log(`[Admin] Admin client joined (${socket.id})`);

      // Send current game state
      socket.emit('game:state', gameStateManager.getState());

      // Send all positions
      const allTeamsData: Record<number, PlayerPosition[]> = {};
      for (let t = 1; t <= 10; t++) {
        allTeamsData[t] = gameStateManager.getTeamMembers(t);
      }
      socket.emit('admin:allPositions', allTeamsData);

      // Send all chat histories
      for (let t = 1; t <= 10; t++) {
        const chatHistory = gameStateManager.getChatHistory(t);
        if (chatHistory.length > 0) {
          socket.emit('chat:history', chatHistory);
        }
      }
    } catch (error) {
      console.error('[Error] admin:join:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin starts timer for a team
   * Event: admin:startTimer
   * Data: teamId
   */
  socket.on('admin:startTimer', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      gameStateManager.startTeamTimer(teamId);

      // Get team route and send initial step
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

      // Broadcast timer start
      io.to(`team:${teamId}`).emit('team:timerStart', {
        teamId,
        duration: 30 * 60 * 1000,
      });

      console.log(`[Admin] Started timer for team ${teamId}`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:startTimer:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin stops timer for a team
   * Event: admin:stopTimer
   * Data: teamId
   */
  socket.on('admin:stopTimer', (teamId: number) => {
    try {
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      gameStateManager.stopTeamTimer(teamId);

      console.log(`[Admin] Stopped timer for team ${teamId}`);
      broadcastGameState();
    } catch (error) {
      console.error('[Error] admin:stopTimer:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin resets the entire game
   * Event: admin:resetGame
   */
  socket.on('admin:resetGame', () => {
    try {
      gameStateManager.resetGame();

      // Clear team connections
      const socketsToDisconnect: string[] = [];
      teamConnections.forEach((value, key) => {
        socketsToDisconnect.push(key);
      });

      for (const socketId of socketsToDisconnect) {
        teamConnections.delete(socketId);
      }

      // Broadcast reset to all
      io.emit('game:state', gameStateManager.getState());

      console.log('[Admin] Game reset');
    } catch (error) {
      console.error('[Error] admin:resetGame:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========== Disconnection Handler ==========
  socket.on('disconnect', () => {
    const connection = teamConnections.get(socket.id);

    if (connection) {
      const { teamId, playerId } = connection;
      // Do NOT remove player from team — keep their last known position
      // so admin can still see where they were and they restore instantly on reconnect
      teamConnections.delete(socket.id);

      console.log(`[Team ${teamId}] Player ${playerId} disconnected (position preserved)`);

      // Broadcast updated state (member still exists with last position)
      broadcastGameState();
    } else {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    }
  });
});

// ========== Server Startup ==========
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`신의 악단 (God's Orchestra) V2 Server`);
  console.log(`========================================`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`Socket.io: ws://localhost:${PORT}`);
  console.log(`========================================`);
});

// Cleanup on shutdown
process.on('SIGINT', () => {
  clearInterval(timerCheckInterval);
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

export { app, server, io };
