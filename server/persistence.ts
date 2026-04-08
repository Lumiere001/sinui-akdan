import fs from 'fs';
import path from 'path';
import type { GameState } from './shared/types.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');

/**
 * Default initial game state
 */
function createInitialGameState(): GameState {
  const teams: Record<number, any> = {};
  for (let i = 1; i <= 10; i++) {
    teams[i] = {
      teamId: i,
      stage: 'idle',
      members: {},
      stage1TimerStartTime: null,
      stage1TimerDuration: 40 * 60 * 1000,
      stage1TimerActive: false,
      stage1TimerExpired: false,
      stage1TimerPaused: false,
      stage1TimerRemainingAtPause: null,
      currentStep: 0,
      completedSteps: [],
      isComplete: false,
      timerStartTime: null,
      timerDuration: 30 * 60 * 1000,
      isTimerActive: false,
      isTimerExpired: false,
      isTimerPaused: false,
      timerRemainingAtPause: null,
      representative: null,
    };
  }

  return {
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

  // Return default state if file doesn't exist or error
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
