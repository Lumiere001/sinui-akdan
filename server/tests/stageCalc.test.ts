import { describe, it, expect } from 'vitest';
import {
  getStageSequence,
  getCurrentStageInfo,
  computeSkipOffset,
  DEFAULT_DURATIONS,
  TEST_DURATIONS,
} from '../shared/types.js';

// 벽시계(wall-clock) 기반 자동 Stage 전환 로직 검증
// 가조: stage1 → stage2 → stage3
// 나조: stage2 → stage1 → stage3

describe('getStageSequence — 그룹별 Stage 순서', () => {
  it('가조는 stage1 → stage2 → stage3 순서', () => {
    expect(getStageSequence('가조')).toEqual(['stage1', 'stage2', 'stage3']);
  });

  it('나조는 stage2 → stage1 → stage3 순서', () => {
    expect(getStageSequence('나조')).toEqual(['stage2', 'stage1', 'stage3']);
  });
});

describe('getCurrentStageInfo — 현재 Stage 자동 판정 (가조)', () => {
  const startTime = 1_700_000_000_000;

  it('시작 0초: stage1, stageIndex 0', () => {
    const info = getCurrentStageInfo(startTime, '가조', DEFAULT_DURATIONS, startTime);
    expect(info.stage).toBe('stage1');
    expect(info.stageIndex).toBe(0);
    expect(info.stageElapsed).toBe(0);
  });

  it('15분 경과: 여전히 stage1', () => {
    const now = startTime + 15 * 60 * 1000;
    const info = getCurrentStageInfo(startTime, '가조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('stage1');
    expect(info.stageElapsed).toBe(15 * 60 * 1000);
    expect(info.stageRemaining).toBe(15 * 60 * 1000);
  });

  it('30분 1초 경과: stage2로 전환', () => {
    const now = startTime + 30 * 60 * 1000 + 1000;
    const info = getCurrentStageInfo(startTime, '가조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('stage2');
    expect(info.stageIndex).toBe(1);
  });

  it('30+32분 = 62분 경과: stage3로 전환', () => {
    const now = startTime + (30 + 32) * 60 * 1000 + 1000;
    const info = getCurrentStageInfo(startTime, '가조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('stage3');
    expect(info.stageIndex).toBe(2);
  });

  it('30+32+30분 이후: finished', () => {
    const now = startTime + (30 + 32 + 30) * 60 * 1000 + 1000;
    const info = getCurrentStageInfo(startTime, '가조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('finished');
    expect(info.stageIndex).toBe(3);
    expect(info.stageRemaining).toBe(0);
  });
});

describe('getCurrentStageInfo — 현재 Stage 자동 판정 (나조)', () => {
  const startTime = 1_700_000_000_000;

  it('시작 직후: stage2부터 시작', () => {
    const info = getCurrentStageInfo(startTime, '나조', DEFAULT_DURATIONS, startTime);
    expect(info.stage).toBe('stage2');
    expect(info.stageIndex).toBe(0);
  });

  it('32분 경과: stage1로 전환', () => {
    const now = startTime + 32 * 60 * 1000 + 1000;
    const info = getCurrentStageInfo(startTime, '나조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('stage1');
    expect(info.stageIndex).toBe(1);
  });

  it('32+30분 = 62분 경과: stage3로 전환', () => {
    const now = startTime + (32 + 30) * 60 * 1000 + 1000;
    const info = getCurrentStageInfo(startTime, '나조', DEFAULT_DURATIONS, now);
    expect(info.stage).toBe('stage3');
  });
});

describe('getCurrentStageInfo — 테스트 모드 (각 Stage 1분)', () => {
  const startTime = 1_700_000_000_000;

  it('테스트 모드 1분 경과: stage2', () => {
    const now = startTime + 60 * 1000 + 100;
    const info = getCurrentStageInfo(startTime, '가조', TEST_DURATIONS, now);
    expect(info.stage).toBe('stage2');
  });

  it('테스트 모드 3분 경과: finished', () => {
    const now = startTime + 3 * 60 * 1000 + 100;
    const info = getCurrentStageInfo(startTime, '가조', TEST_DURATIONS, now);
    expect(info.stage).toBe('finished');
  });
});

describe('computeSkipOffset — Stage 건너뛰기 오프셋', () => {
  const startTime = 1_700_000_000_000;

  it('stage1 도중에 skip: 남은 시간만큼 오프셋 반환', () => {
    const now = startTime + 10 * 60 * 1000;
    const offset = computeSkipOffset(startTime, '가조', DEFAULT_DURATIONS, now);
    // stage1은 30분이고 10분 경과했으니 남은 20분
    expect(offset).toBe(20 * 60 * 1000);
  });

  it('이미 finished 상태면 0을 반환', () => {
    const now = startTime + 100 * 60 * 1000;
    const offset = computeSkipOffset(startTime, '가조', DEFAULT_DURATIONS, now);
    expect(offset).toBe(0);
  });
});
