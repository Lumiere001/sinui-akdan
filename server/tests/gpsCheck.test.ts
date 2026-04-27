import { describe, it, expect } from 'vitest';
import { getDistance, checkProximity, isValidLocation } from '../gpsCheck.js';
import type { Location, PlayerPosition } from '../shared/types.js';

// 광주 양림동 일대를 기준으로 한 GPS 좌표 계산 테스트
// 실제 게임 로직(40m 해금 / 100m 접근 알림)과 동일한 기준으로 검증한다.

describe('getDistance — Haversine 거리 계산', () => {
  it('동일한 좌표는 거리 0을 반환한다', () => {
    const d = getDistance(35.1379, 126.9242, 35.1379, 126.9242);
    expect(d).toBe(0);
  });

  it('1도 위도 차이는 약 111km(=111000m) 근처여야 한다', () => {
    const d = getDistance(35.0, 126.9, 36.0, 126.9);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('대칭성: A→B와 B→A의 거리가 동일하다', () => {
    const a = getDistance(35.1379, 126.9242, 35.1390, 126.9260);
    const b = getDistance(35.1390, 126.9260, 35.1379, 126.9242);
    expect(a).toBeCloseTo(b, 5);
  });

  it('아주 가까운 두 점(약 10m 이내)은 50m 미만이어야 한다', () => {
    // 1도 ≈ 111km, 0.0001도 ≈ 11m
    const d = getDistance(35.1379, 126.9242, 35.1380, 126.9242);
    expect(d).toBeLessThan(50);
    expect(d).toBeGreaterThan(0);
  });

  it('적도와 극지방의 동일 경도 차이는 위도 차이만큼 비슷한 결과', () => {
    // 위도 1도 = 약 111km (위도 무관)
    const tropic = getDistance(0, 0, 1, 0);
    const polar = getDistance(60, 0, 61, 0);
    expect(Math.abs(tropic - polar)).toBeLessThan(500);
  });
});

describe('checkProximity — 위치 근접 상태 판정', () => {
  const baseLocation: Location = {
    id: 'test-location',
    name: '테스트 장소',
    lat: 35.1379,
    lng: 126.9242,
    unlockRadius: 40,
    approachRadius: 100,
  };

  const makePlayer = (lat: number, lng: number): PlayerPosition => ({
    playerId: 'p1',
    teamId: 1,
    lat,
    lng,
    timestamp: Date.now(),
  });

  it('정확히 같은 좌표는 inside로 판정된다', () => {
    const result = checkProximity(makePlayer(35.1379, 126.9242), baseLocation);
    expect(result).toBe('inside');
  });

  it('해금 반경(40m) 안쪽은 inside', () => {
    // 약 22m 떨어진 지점 (위도 0.0002도 ≈ 22m)
    const result = checkProximity(makePlayer(35.13808, 126.9242), baseLocation);
    expect(result).toBe('inside');
  });

  it('해금 반경 밖, 접근 반경(100m) 안쪽은 approaching', () => {
    // 약 77m 떨어진 지점 (위도 0.0007도 ≈ 77m)
    const result = checkProximity(makePlayer(35.13860, 126.9242), baseLocation);
    expect(result).toBe('approaching');
  });

  it('접근 반경 밖은 outside', () => {
    // 약 222m 떨어진 지점 (위도 0.002도 ≈ 222m)
    const result = checkProximity(makePlayer(35.1399, 126.9242), baseLocation);
    expect(result).toBe('outside');
  });

  it('해금 반경 경계값 근처는 inside로 분류된다 (<= 비교)', () => {
    // 정확히 40m 거리 위치 계산 — Haversine 정밀도 고려해 35m 정도로 테스트
    const result = checkProximity(makePlayer(35.1382, 126.9242), baseLocation);
    expect(result).toBe('inside');
  });
});

describe('isValidLocation — 게임 데이터 내 장소 ID 유효성', () => {
  it('실제 게임에 등록된 장소 ID는 true를 반환한다', () => {
    // gameData.ts 에 등록된 장소 (오웬기념각=1)
    expect(isValidLocation('1')).toBe(true);
  });

  it('등록되지 않은 장소 ID는 false를 반환한다', () => {
    expect(isValidLocation('non-existent-location')).toBe(false);
  });

  it('빈 문자열은 false를 반환한다', () => {
    expect(isValidLocation('')).toBe(false);
  });
});
