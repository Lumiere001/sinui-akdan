import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { adminRouter } from './adminRoutes.js';
import { gameStateManager } from './gameState.js';
import { checkProximity, checkTeamPresence, isValidLocation } from './gpsCheck.js';
import { getTeamConfig, getLocation } from './gameData.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerPosition,
} from './shared/types';

// ========== Configuration ==========
const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [CLIENT_URL, 'https://sinui-akdan.vercel.app', 'http://localhost:5173'];
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
 * Broadcast game state to all connected clients (admin + all teams)
 */
function broadcastGameState(): void {
  const state = gameStateManager.getState();
  io.to('admin').emit('game:state', state);
  // 모든 팀 룸에도 게임 상태 전송
  for (let t = 1; t <= 10; t++) {
    io.to(`team:${t}`).emit('game:state', state);
  }
}

/**
 * Track team members and their positions for admin monitoring
 * Maps team members to their teams
 */
const teamConnections = new Map<string, { teamId: number; playerId: string }>();

// ========== Socket.io Connection Handler ==========
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ========== Player Events ==========

  /**
   * Player joins their team room
   * Event: player:join
   * Data: { teamId: number, playerId: string }
   */
  /**
   * Admin joins the admin room
   * Event: admin:join
   */
  socket.on('admin:join', () => {
    socket.join('admin');
    console.log(`[Admin] Admin client joined (${socket.id})`);
    // 즉시 현재 게임 상태 전송
    socket.emit('game:state', gameStateManager.getState());
  });

  socket.on('player:join', (data) => {
    const { teamId, playerId } = data;

    try {
      if (!teamId || !playerId) {
        socket.emit('error', { message: 'Missing teamId or playerId' });
        return;
      }

      // Validate team ID (1-10)
      if (teamId < 1 || teamId > 10) {
        socket.emit('error', { message: 'Invalid team ID' });
        return;
      }

      // Track this connection
      teamConnections.set(socket.id, { teamId, playerId });

      // Add player to team in game state
      gameStateManager.addPlayerToTeam(teamId, playerId);

      // Join team-specific room
      const teamRoom = `team:${teamId}`;
      socket.join(teamRoom);

      console.log(`[Team ${teamId}] Player ${playerId} joined (${socket.id})`);

      // Send current game state to this player
      socket.emit('game:state', gameStateManager.getState());

      // Notify team members about new join
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));

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
   * Data: PlayerPosition { playerId, teamId, lat, lng, timestamp }
   */
  socket.on('player:position', (data: PlayerPosition) => {
    try {
      const { teamId, playerId, lat, lng } = data;

      // Update position in game state
      gameStateManager.updatePlayerPosition(teamId, playerId, lat, lng);

      // Broadcast updated positions to team members
      const teamRoom = `team:${teamId}`;
      io.to(teamRoom).emit('team:positions', gameStateManager.getTeamMembers(teamId));

      // Broadcast to admin monitoring
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
   * Runs GPS proximity check and verifies team presence
   * Event: player:checkLocation
   * Data: { locationId: string }
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

      // Check if game is active
      const state = gameStateManager.getState();
      if (!state.isActive) {
        socket.emit('error', { message: 'Game is not active' });
        return;
      }

      // Check if team has already unlocked a location in this round
      if (gameStateManager.hasTeamUnlockedLocation(teamId)) {
        socket.emit('team:wrong', {
          teamId,
          locationId,
        });
        return;
      }

      // Get team's correct location for this round
      const teamConfig = getTeamConfig(state.currentRound, teamId);
      if (!teamConfig) {
        socket.emit('error', { message: 'Team config not found' });
        return;
      }

      // Check team presence at location
      const presenceResult = checkTeamPresence(teamId, locationId, gameStateManager);

      // Broadcast member count to team (even if insufficient)
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

      // Check if location is correct for this team
      const isCorrect = locationId === teamConfig.correctLocation;

      if (isCorrect) {
        // Correct location found!
        gameStateManager.unlockLocation(teamId, locationId, teamConfig.correctPhoto);

        console.log(
          `[Team ${teamId}] Unlocked correct location ${locationId} - Photo: ${teamConfig.correctPhoto}`,
        );

        // Broadcast unlock to team
        io.to(teamRoom).emit('team:unlock', {
          teamId,
          locationId,
          photo: teamConfig.correctPhoto,
        });

        // Broadcast to admin
        broadcastGameState();
      } else {
        // Wrong location
        console.log(
          `[Team ${teamId}] Wrong location ${locationId} (correct: ${teamConfig.correctLocation})`,
        );

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

  // ========== Admin Events ==========

  /**
   * Admin starts a round
   */
  socket.on('admin:startRound', (round: number) => {
    try {
      if (round !== 1 && round !== 2) {
        socket.emit('error', { message: 'Round must be 1 or 2' });
        return;
      }
      gameStateManager.startRound(round as 1 | 2);
      broadcastGameState();
      console.log(`[Admin] Round ${round} started`);
    } catch (error) {
      console.error('[Error] admin:startRound:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin stops current round
   */
  socket.on('admin:stopRound', () => {
    try {
      gameStateManager.stopRound();
      broadcastGameState();
      console.log('[Admin] Round stopped');
    } catch (error) {
      console.error('[Error] admin:stopRound:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Admin resets game
   */
  socket.on('admin:resetGame', () => {
    try {
      gameStateManager.resetGame();
      broadcastGameState();
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
      gameStateManager.removePlayerFromTeam(teamId, playerId);
      teamConnections.delete(socket.id);

      console.log(`[Team ${teamId}] Player ${playerId} disconnected`);

      // Broadcast updated positions
      io.to(`team:${teamId}`).emit('team:positions', gameStateManager.getTeamMembers(teamId));
      broadcastGameState();
    } else {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    }
  });
});

// ========== Server Startup ==========
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`신의 악단 (God's Orchestra) Server`);
  console.log(`========================================`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin API: http://localhost:${PORT}/api/admin`);
  console.log(`Socket.io: ws://localhost:${PORT}`);
  console.log(`========================================`);
});

export { app, server, io };
