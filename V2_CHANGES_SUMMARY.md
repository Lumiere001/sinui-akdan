# Sinui-Akdan V2 Server Rewrite - Changes Summary

## Overview
Complete server-side rewrite for V2 of the GPS-based treasure hunt app with major architectural changes.

## Key Features Implemented

### 1. Multi-Step Sequential Hunt (3 Steps per Team)
- Each team completes a 3-step journey
- Steps must be completed in order (1→2→3)
- Each step has correct and wrong location options (~300-400m apart)
- Upon correct location, advance to next step hint
- After step 3 correct, team is marked complete

### 2. Per-Team Individual 25-Minute Timers
- Each team has individual timer (started via admin command)
- 25-minute duration (1500000ms)
- Automatic expiration checked every 1 second
- Timer stops when team completes or manually stopped
- Can manage individual team timers independently

### 3. Pledge System
- Players can submit pledges (final action after steps)
- Stored server-side in persistent JSON
- Tracked by playerId with completion timestamp
- Pledge status checked/retrieved on demand

### 4. Chat System
- Team representative ↔ Admin communication
- Only team representative can send messages
- Messages stored per team with full history
- Real-time broadcast to team and admin

### 5. JSON File Persistence
- Game state saved to `./data.json` in server root
- Loads on server startup
- Debounced saves (1 second) for performance
- Includes teams, pledges, and chat messages

### 6. Location Changes
- **Removed**: Location 7 (김현승 시비)
- **Kept**: 7 locations total
  1. 오웬기념각 (35.138299, 126.915901)
  2. 선교사 묘역 (35.139354, 126.911123)
  3. 우일선 선교사 사택 (35.138358, 126.911861)
  4. 펭귄마을 (35.140536, 126.917556)
  5. 이장우 가옥 (35.140423, 126.914215)
  6. 양림교회 (35.138181, 126.915584)
  8. 최승효 가옥 (35.141354, 126.913985)

### 7. Team Organization
- **Round 1**: Teams 1-5 (simultaneous)
- **Round 2**: Teams 6-10 (simultaneous)
- Each team has unique 3-step route with different location pairs
- Team passwords: 1='1111', 2='2222', ..., 9='9999', 10='0000'

## File Structure

### Core Files (Complete Rewrite)
- **shared/types.ts** - V2 type definitions (identical to server/shared/types.ts)
- **server/shared/types.ts** - V2 type definitions (identical to shared/types.ts)
- **server/persistence.ts** - JSON file save/load functionality (NEW)
- **server/gameData.ts** - Locations and 10 unique team routes (3 steps each)
- **server/gameState.ts** - Complete GameStateManager singleton with timer/step/pledge/chat
- **server/index.ts** - Socket.io server with all V2 event handlers
- **server/adminRoutes.ts** - REST API endpoints for game management

### Unchanged Files
- **server/gpsCheck.ts** - Haversine formula (unchanged)

## Type System Updates

### New Types
- `RouteStep` - Single step in multi-step route
- `TeamRoute` - Complete 3-step route for team
- `TeamState` - Extended with currentStep, completedSteps, timer fields, representative
- `PledgeRecord` - Player pledge with timestamp
- `ChatMessage` - Team-admin communication
- Updated `GameState` - Now includes pledges and chatMessages

### New Socket Events

**Client to Server:**
- `player:join` - Updated with playerName, isRepresentative flag
- `player:checkLocation` - Unchanged logic (works with 3-step flow)
- `pledge:submit` - New: submit pledge
- `pledge:check` - New: check pledge status
- `chat:send` - New: send message (representative only)
- `admin:startTimer` - New: start individual team timer
- `admin:stopTimer` - New: stop individual team timer
- Removed: `admin:startRound`, `admin:stopRound` (replaced with per-team timers)

**Server to Client:**
- `team:stageUpdate` - New: send step hint and location options
- `team:stepComplete` - New: step completed successfully
- `team:timerStart` - New: timer started
- `team:timerExpired` - New: timer expired
- `pledge:status` - New: pledge status response
- `chat:message` - New: incoming chat message
- `chat:history` - New: chat history on join
- `representative:status` - New: representative update
- Removed: `game:started`, `game:stopped`, `team:unlock` (replaced with `team:stepComplete`)

## Game Flow (V2)

1. **Join**: Player joins team, specifies if representative
2. **Wait**: Team waits for admin to start timer
3. **Start**: Admin starts timer for team
   - Team receives Step 1 hint + location options
   - 25-minute timer begins
4. **Step Loop** (repeat for steps 1-3):
   - Team navigates to correct location
   - 3+ members must be within 50m
   - Player checks location (must be within 40m)
   - If correct: advance to next step
   - If wrong: show wrong photo, stay on same step
5. **Complete**: After step 3 correct → team complete → show final photo
6. **Pledge**: Player submits pledge (optional final action)
7. **Chat**: Representative can message admin during game

## Configuration

### Timer Settings
- Duration: 1500000ms (25 minutes)
- Check interval: 1000ms (1 second)
- Debounce save: 1000ms

### GPS Settings
- Unlock radius: 40m (to check location)
- Approach radius: 100m (approach notification)
- Team check radius: 50m (for member presence)
- Required members: 3 (to check location)

### Passwords
- Admin: `admin2024` (via env or default)
- Teams: 1-10 with sequential 4-digit codes

## Data Persistence

### File Location
- `./data.json` (relative to server root)

### Structure
```json
{
  "teams": {
    "1": {
      "teamId": 1,
      "members": { "playerId": {...} },
      "currentStep": 1,
      "completedSteps": [1],
      "isComplete": false,
      "timerStartTime": 1712590800000,
      "timerDuration": 1500000,
      "isTimerActive": true,
      "isTimerExpired": false,
      "representative": "playerId"
    },
    ...
  },
  "pledges": {
    "playerId": {
      "playerId": "playerId",
      "teamId": 1,
      "completedAt": 1712590900000
    }
  },
  "chatMessages": {
    "1": [
      {
        "id": "...",
        "teamId": 1,
        "senderId": "...",
        "senderName": "...",
        "message": "...",
        "timestamp": 1712590900000,
        "isAdmin": false
      }
    ]
  }
}
```

## Admin REST API Endpoints

- `GET /api/admin/state` - Full game state
- `GET /api/admin/teams` - All teams summary
- `GET /api/admin/team/:teamId` - Specific team details
- `POST /api/admin/team/:teamId/start` - Start team timer
- `POST /api/admin/team/:teamId/stop` - Stop team timer
- `POST /api/admin/team/:teamId/reset` - Reset team
- `POST /api/admin/reset` - Reset entire game
- `GET /api/admin/pledges` - All pledges by team
- `GET /api/admin/chat` - All chat messages
- `GET /api/admin/chat/:teamId` - Team chat history
- `GET /api/admin/game-config` - Locations and routes
- `GET /api/admin/timer/:teamId` - Team timer info

## Testing Checklist

- [ ] Server starts without errors
- [ ] Players can join teams with correct password
- [ ] Admin can authenticate and receive state
- [ ] Per-team timer starts correctly
- [ ] Step 1 hint sent on timer start
- [ ] Location checks validate member count (3+ needed)
- [ ] Location checks validate GPS proximity (40m)
- [ ] Correct location advances to step 2
- [ ] Wrong location sends wrong photo, no advance
- [ ] Step 2 and 3 work same way
- [ ] Step 3 completion marks team complete and shows final photo
- [ ] Pledge submit/check works
- [ ] Team representative can send chat messages
- [ ] Chat messages broadcast to team and admin
- [ ] Timer expiration events broadcast correctly
- [ ] Game state persists to data.json
- [ ] Game state loads on server restart
- [ ] Admin reset clears all data

## Notes

- Both `shared/types.ts` and `server/shared/types.ts` are identical (MD5: eb16e27eb1323c0d96f56a6a6bf654c5)
- ES module syntax used throughout (import/export)
- Server imports use `.js` extensions for compiled output
- Singleton GameStateManager handles all state mutations
- All state changes trigger persistence save (debounced)
- Socket.io rooms: `admin`, `team:1` through `team:10`
- Player connection tracking via `teamConnections` Map
- Timer checks run on server, not client (authoritative)

