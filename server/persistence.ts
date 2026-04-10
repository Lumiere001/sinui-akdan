import fs from 'fs';
import path from 'path';
import type { GameState, TeamGroup } from './shared/types.js';
import { DEFAULT_DURATIONS } from './shared/types.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');

/**
 * V3 초기 게임 상태 생성
 * - 팀 1~5: 가조, 팀 6~10: 나조
 * - 벽시계 기반 자동 전환 (타이머 필드 제거)
 */
function createInitialGameState(): GameState {
  const teams: Record<number, any> = {};
  for (let i = 1; i <= 10; i++) {
    const group: TeamGroup = i <= 5 ? '가조' : '나조';
    teams[i] = {
      teamId: i,
      group,
      stage: 'idle',
      startTime: null,
      members: {},
      representative: null,
      // Stage 1
      stage1CompletedAt: null,
      stage1ElapsedMs: null,
      // Stage 2
      currentStep: 0,
      completedSteps: [],
      stage2CompletedAt: null,
      stage2ElapsedMs: null,
      stage2History: [],
    };
  }

  return {
    masterStartTime: null,
    testMode: false,
    durations: { ...DEFAULT_DURATIONS },
    teams,
    pledges: {},
    chatMessages: {},
  };
}

/**
 * Load game state from JSON file
 */
export function loadGameState(): GameState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const state = JSON.parse(data) as GameState;
      return state;
    }
  } catch (error) {
    console.error('Error loading game state:', error);
  }

  return createInitialGameState();
}

/**
 * Save game state to JSON file
 */
export function saveGameState(state: GameState): void {
  try {
    const jsonData = JSON.stringify(state, null, 2);
    fs.writeFileSync(DATA_FILE, jsonData, 'utf-8');
    console.log(`Game state saved to ${DATA_FILE}`);
  } catch (error) {
    console.error('Error saving game state:', error);
  }
}

/**
 * Debounced save function for performance
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSaveGameState(state: GameState, delayMs: number = 1000): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveGameState(state);
  }, delayMs);
}

/**
 * Reset data file
 */
export function resetDataFile(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
  } catch (error) {
    console.error('Error resetting data file:', error);
  }
}

/**
 * Get a fresh initial game state (for reset)
 */
export { createInitialGameState };
