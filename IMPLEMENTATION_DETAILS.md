# V2 Implementation Details

## Files Modified

### 1. `/shared/types.ts` and `/server/shared/types.ts`
- **Status**: Rewritten (identical copies)
- **Key Changes**:
  - New: `RouteStep`, `TeamRoute`, `PledgeRecord`, `ChatMessage` types
  - `TeamState` now includes: currentStep (0-4), completedSteps[], timer fields, representative
  - `GameState` now includes: pledges{}, chatMessages{}
  - New socket events for steps, timers, pledges, chat

### 2. `/server/persistence.ts`
- **Status**: NEW FILE
- **Functions**:
  - `loadGameState()` - Load from data.json or create initial state
  - `saveGameState(state)` - Save to data.json
  - `debouncedSaveGameState(state, delayMs)` - Debounced save (1sec default)
  - `resetDataFile()` - Delete data.json

### 3. `/server/gameData.ts`
- **Status**: Complete rewrite
- **Changes**:
  - Removed location 7 (김현승 시비)
  - Kept 7 locations with proper coordinates
  - Created 10 unique TeamRoute objects (one per team)
  - Each TeamRoute has 3 RouteStep objects
  - Each step has correct/wrong location pair with appropriate photos
  - Exports: `getLocation()`, `getAllLocations()`, `getTeamRoute()`, `getTeamRound()`

### 4. `/server/gameState.ts`
- **Status**: Complete rewrite
- **Key Classes/Methods**:
  - `GameStateManager` singleton
  - Timer management: `startTeamTimer()`, `stopTeamTimer()`, `isTeamTimerExpired()`, `expireTeamTimer()`, `getTeamTimerInfo()`
  - Step management: `advanceStep()`, `completeTeam()`
  - Pledge system: `addPledge()`, `hasPledge()`, `getPledge()`
  - Chat system: `addChatMessage()`, `getChatHistory()`, `clearChatHistory()`
  - Representative: `setRepresentative()`, `getRepresentative()`
  - Player tracking: `updatePlayerPosition()`, `addPlayerToTeam()`, `removePlayerFromTeam()`, `getTeamMembers()`
  - Team state: `getTeamState()`, `resetTeam()`
  - Game reset: `resetGame()`

### 5. `/server/index.ts`
- **Status**: Complete rewrite
- **Key Sections**:
  - Configuration with ADMIN_PASSWORD and TEAM_PASSWORDS
  - Singleton timer check interval (every 1 second)
  - Socket event handlers:
    - `player:join` - Validate password, add to team, set representative
    - `player:position` - Update position, check member counts at locations
    - `player:checkLocation` - Validate step/proximity/presence, advance step
    - `pledge:submit` - Record pledge
    - `pledge:check` - Return pledge status
    - `chat:send` - Representative-only messages
    - `admin:join` - Admin authentication
    - `admin:startTimer` - Start individual team timer, send step 1 hint
    - `admin:stopTimer` - Stop team timer
    - `admin:resetGame` - Reset all game state
  - Disconnect handler - Clean up player and broadcast updates
  - Broadcast function - Send state to all clients

### 6. `/server/adminRoutes.ts`
- **Status**: Complete rewrite (for V2)
- **Endpoints**:
  - `GET /api/admin/state` - Full game state
  - `GET /api/admin/teams` - All teams with timer/step info
  - `GET /api/admin/team/:teamId` - Team details with route and chat
  - `POST /api/admin/team/:teamId/start` - Start team timer
  - `POST /api/admin/team/:teamId/stop` - Stop team timer
  - `POST /api/admin/team/:teamId/reset` - Reset team
  - `POST /api/admin/reset` - Reset all
  - `GET /api/admin/pledges` - Pledges by team
  - `GET /api/admin/chat` - All chat
  - `GET /api/admin/chat/:teamId` - Team chat
  - `GET /api/admin/game-config` - Locations and routes
  - `GET /api/admin/timer/:teamId` - Timer info

### 7. `/server/gpsCheck.ts`
- **Status**: UNCHANGED
- **Reason**: Haversine formula and proximity checking unchanged for V2

## Data Flow

### Player Join Flow
```
player:join (with password, isRepresentative flag)
  ↓
Validate password
  ↓
Create TeamState member entry
  ↓
Set representative if flagged
  ↓
Join socket room (team:X)
  ↓
Emit: game:state, pledge:status, chat:history, representative:status
  ↓
Broadcast: team:positions to team
```

### Timer Start Flow (Admin)
```
admin:startTimer(teamId)
  ↓
gameStateManager.startTeamTimer(teamId)
  - Set timerStartTime = Date.now()
  - Set isTimerActive = true
  - Set currentStep = 1
  - Clear completedSteps
  ↓
Get TeamRoute and first step
  ↓
Emit: team:stageUpdate with step 1 hint + location IDs
Emit: team:timerStart with duration
  ↓
Save state to data.json (debounced)
```

### Location Check Flow
```
player:checkLocation(locationId)
  ↓
Validate: location exists, timer active, not complete
  ↓
Get current step route
  ↓
Check team presence at location (3+ within 50m)
  ↓
If insufficient: emit team:memberCount and return
  ↓
Get player position
  ↓
Check GPS proximity (must be ≤40m)
  ↓
If proximity bad: emit error and return
  ↓
Compare locationId to currentStepRoute.correctLocation
  ↓
If CORRECT:
  - Emit team:stepComplete with photo
  - gameStateManager.advanceStep(teamId)
  - If not complete: Emit team:stageUpdate with next step
  - If complete: Emit team:complete with final photo
  - Save state
  ↓
If WRONG:
  - Emit team:wrong with wrong photo
```

### Timer Expiration (Server-Side Check)
```
Every 1 second:
  For each team 1-10:
    If gameStateManager.isTeamTimerExpired(teamId):
      - Mark as expired
      - Stop active timer
      - Emit team:timerExpired
      - Save state
```

### Chat Message Flow (Representative Only)
```
chat:send(teamId, message)
  ↓
Verify sender is team representative
  ↓
gameStateManager.addChatMessage()
  - Create ChatMessage with id, timestamp, isAdmin=false
  - Add to state.chatMessages[teamId]
  ↓
Emit to team:X room and admin room
  ↓
Save state (debounced)
```

## Persistence

### Load on Startup
```
server starts
  ↓
GameStateManager constructor
  ↓
loadGameState() from data.json
  ↓
If file doesn't exist: create initial state
  ↓
All subsequent operations use loaded state
```

### Save on Changes
```
Any state mutation:
  ↓
Call debouncedSaveGameState()
  ↓
Clear existing timeout
  ↓
Set new timeout (1000ms)
  ↓
On timeout: write to data.json
```

### Reset
```
admin:resetGame()
  ↓
gameStateManager.resetGame()
  - Clear all teams, pledges, chat
  - resetDataFile() deletes data.json
  ↓
Emit new game:state to all clients
```

## Team Routes (Examples)

### Team 1 (Round 1)
- Step 1: 1→3 (오웬기념각 vs 우일선 선교사 사택)
- Step 2: 4→5 (펭귄마을 vs 이장우 가옥)
- Step 3: 8→2 (최승효 가옥 vs 선교사 묘역)
- Final: final_T1.jpg

### Team 6 (Round 2)
- Step 1: 2→6 (선교사 묘역 vs 양림교회)
- Step 2: 1→5 (오웬기념각 vs 이장우 가옥)
- Step 3: 8→4 (최승효 가옥 vs 펭귄마을)
- Final: final_T6.jpg

(See gameData.ts for all 10 teams)

## State Machine

### Team currentStep States
- **0**: Not started (no timer active)
- **1**: Playing step 1
- **2**: Playing step 2
- **3**: Playing step 3
- **4**: Complete (all steps done)

### Team Timer States
- **timerStartTime**: null or timestamp when started
- **isTimerActive**: true if currently counting down
- **isTimerExpired**: true if duration exceeded

## Socket Room Structure
```
Admin room: 'admin'
  - Receives all state updates
  - Receives all position updates
  - Receives all chat messages
  - Can start/stop team timers

Team rooms: 'team:1' through 'team:10'
  - Receive own state
  - Receive own positions
  - Receive own steps/hints
  - Send/receive chat
```

## Authentication
- Admin: Header `x-admin-password` on REST, password param on socket
- Teams: Hardcoded passwords in index.ts (1111-0000)
- All validation server-side

## Error Handling
- Try-catch blocks on all socket handlers
- Emit 'error' event on failures
- Log to console for debugging
- Graceful degradation (connection.get returns null safely)

