import type { GameData, Location, TeamConfig } from './shared/types.js';

/**
 * All 8 locations in Yanglim Village (양림마을)
 * GPS coordinates and metadata for the treasure hunt
 */
const LOCATIONS: Location[] = [
  {
    id: '1',
    name: '오웬기념각',
    lat: 35.138299,
    lng: 126.915901,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '2',
    name: '선교사 묘역',
    lat: 35.139354,
    lng: 126.911123,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '3',
    name: '우일선 선교사 사택',
    lat: 35.138358,
    lng: 126.911861,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '4',
    name: '펭귄마을',
    lat: 35.140536,
    lng: 126.917556,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '5',
    name: '이장우 가옥',
    lat: 35.140423,
    lng: 126.914215,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '6',
    name: '양림교회',
    lat: 35.138181,
    lng: 126.915584,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '7',
    name: '김현승 시비',
    lat: 35.136977,
    lng: 126.917684,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '8',
    name: '최승효 가옥',
    lat: 35.141354,
    lng: 126.913985,
    unlockRadius: 40,
    approachRadius: 100,
  },
];

/**
 * Hints for each location (Korean text)
 */
const HINTS: Record<string, string> = {
  '1': '이곳에서 소리가 처음 울렸다. 하나의 무대에 두 개의 문이 있으니, 들어가는 길이 나뉘어 있었으되 듣는 곡은 하나였다. 벽의 빛깔은 하늘이 흐린 날과 같다.',
  '2': '연주를 마치고 악기를 내려놓은 이들이 모인 곳이다. 스물 둘의 이름이 돌 위에 새겨져 있으며, 배움의 터 안에 이 언덕이 있다. 이국의 풀이 그들 곁에 자란다.',
  '3': '병을 고치던 자가 살던 집이다. 이 마을의 서양 가옥 중 가장 오래 서 있으니, 백 년을 넘긴 벽이 아직 따뜻하다. 이 집의 주인은 다른 이의 이름으로 불렸다.',
  '4': '이곳은 누가 시킨 것이 아니다. 사는 이들이 스스로 만든 무대이며, 골목 하나하나가 작품이다. 큰 건물이 아니라 좁은 길 사이에서 이 장소를 찾아라.',
  '5': '큰 문은 닫혀 있으나 들어갈 수 없는 것은 아니다. 왼편에 작은 문이 있다. 이 집은 남쪽 땅의 방식을 따르지 않고, 서울의 방식으로 지어졌다. 안에 들어서면 동쪽 나라의 정원이 보인다.',
  '6': '이 마을에 세워진 첫 번째 악단의 거처이다. 지금의 모습은 첫 모습이 아니니, 다시 지어진 것은 전쟁이 끝난 뒤였다. 벽의 빛깔은 노을과 같고, 그 앞에 사백 년을 산 나무가 서 있다.',
  '7': '악보가 아니라 시(詩)가 새겨진 돌이다. 이 돌을 남긴 자는 가을에 기도했고, 배움의 터 언덕길을 걸으며 곡을 떠올렸다. 그의 아버지는 이 마을에서 악단을 이끌었다.',
  '8': '겉으로는 동쪽 나라의 연회장이었으나, 속으로는 숨겨진 방이 있었다. 이 집의 주인은 두 개의 얼굴로 살았으니, 하나는 손님을 맞이하는 얼굴이요, 하나는 나라를 구하려는 얼굴이었다.',
};

/**
 * Round 1 team assignments (Teams 1-5)
 */
const ROUND_1_TEAMS: Record<number, TeamConfig> = {
  1: {
    teamId: 1,
    visibleLocations: ['1', '3', '5', '6', '8'],
    correctLocation: '1',
    hint: HINTS['1'],
    correctPhoto: 'score_11.jpg',
    wrongPhoto: 'score_11.jpg',
  },
  2: {
    teamId: 2,
    visibleLocations: ['1', '3', '4', '5', '7'],
    correctLocation: '3',
    hint: HINTS['3'],
    correctPhoto: 'score_12.jpg',
    wrongPhoto: 'score_12.jpg',
  },
  3: {
    teamId: 3,
    visibleLocations: ['2', '3', '5', '7', '8'],
    correctLocation: '5',
    hint: HINTS['5'],
    correctPhoto: 'score_13.jpg',
    wrongPhoto: 'score_13.jpg',
  },
  4: {
    teamId: 4,
    visibleLocations: ['1', '4', '6', '7', '8'],
    correctLocation: '7',
    hint: HINTS['7'],
    correctPhoto: 'score_14.jpg',
    wrongPhoto: 'score_14.jpg',
  },
  5: {
    teamId: 5,
    visibleLocations: ['2', '4', '5', '6', '8'],
    correctLocation: '4',
    hint: HINTS['4'],
    correctPhoto: 'score_15.jpg',
    wrongPhoto: 'score_15.jpg',
  },
};

/**
 * Round 2 team assignments (Teams 6-10)
 */
const ROUND_2_TEAMS: Record<number, TeamConfig> = {
  6: {
    teamId: 6,
    visibleLocations: ['2', '4', '6', '7', '8'],
    correctLocation: '2',
    hint: HINTS['2'],
    correctPhoto: 'score_16.jpg',
    wrongPhoto: 'score_16.jpg',
  },
  7: {
    teamId: 7,
    visibleLocations: ['1', '3', '5', '6', '8'],
    correctLocation: '6',
    hint: HINTS['6'],
    correctPhoto: 'score_17.jpg',
    wrongPhoto: 'wrong_17.jpg',
  },
  8: {
    teamId: 8,
    visibleLocations: ['2', '3', '5', '7', '8'],
    correctLocation: '8',
    hint: HINTS['8'],
    correctPhoto: 'score_18.jpg',
    wrongPhoto: 'score_18.jpg',
  },
  9: {
    teamId: 9,
    visibleLocations: ['1', '4', '5', '6', '7'],
    correctLocation: '5',
    hint: HINTS['5'],
    correctPhoto: 'score_19.jpg',
    wrongPhoto: 'score_19.jpg',
  },
  10: {
    teamId: 10,
    visibleLocations: ['1', '2', '4', '6', '8'],
    correctLocation: '1',
    hint: HINTS['1'],
    correctPhoto: 'score_20.jpg',
    wrongPhoto: 'score_20.jpg',
  },
};

/**
 * Complete game data structure with all locations and round configurations
 */
export const gameData: GameData = {
  locations: LOCATIONS,
  rounds: {
    '1': {
      roundId: 1,
      teams: ROUND_1_TEAMS,
    },
    '2': {
      roundId: 2,
      teams: ROUND_2_TEAMS,
    },
  },
};

/**
 * Helper function to get location by ID
 */
export function getLocation(locationId: string): Location | undefined {
  return gameData.locations.find((loc) => loc.id === locationId);
}

/**
 * Helper function to get team config for a specific round
 */
export function getTeamConfig(round: number, teamId: number): TeamConfig | undefined {
  return gameData.rounds[round.toString()]?.teams[teamId];
}

/**
 * Helper function to get all locations
 */
export function getAllLocations(): Location[] {
  return gameData.locations;
}
