import type { Location, TeamRoute, RouteStep } from './shared/types.js';

/**
 * All 9 locations in Yanglim Village (양림마을)
 * V3: Redesigned routes with 2 new locations (조아라기념관, 호랑가시나무)
 * GPS coordinates verified via Google Maps
 * Center: 35.140252, 126.912400
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
    id: '8',
    name: '최승효 가옥',
    lat: 35.141354,
    lng: 126.913985,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '10',
    name: '조아라 기념관',
    lat: 35.138778,
    lng: 126.914419,
    unlockRadius: 40,
    approachRadius: 100,
  },
  {
    id: '11',
    name: '호랑가시나무',
    lat: 35.137888,
    lng: 126.911828,
    unlockRadius: 40,
    approachRadius: 100,
  },
];

/**
 * Hints for each location (Korean text)
 * Written in literary Korean style for the 신의 악단 narrative
 */
const HINTS: Record<string, string> = {
  '1': '이곳에서 소리가 처음 울렸다. 하나의 무대에 두 개의 문이 있으니, 들어가는 길이 나뉘어 있었으되 듣는 곡은 하나였다. 벽의 빛깔은 하늘이 흐린 날과 같다.',
  '2': '연주를 마치고 악기를 내려놓은 이들이 모인 곳이다. 스물 둘의 이름이 돌 위에 새겨져 있으며, 배움의 터 안에 이 언덕이 있다. 이국의 풀이 그들 곁에 자란다.',
  '3': '병을 고치던 자가 살던 집이다. 이 마을의 서양 가옥 중 가장 오래 서 있으니, 백 년을 넘긴 벽이 아직 따뜻하다. 이 집의 주인은 다른 이의 이름으로 불렸다.',
  '4': '이곳은 누가 시킨 것이 아니다. 사는 이들이 스스로 만든 무대이며, 골목 하나하나가 작품이다. 큰 건물이 아니라 좁은 길 사이에서 이 장소를 찾아라.',
  '5': '큰 문은 닫혀 있으나 들어갈 수 없는 것은 아니다. 왼편에 작은 문이 있다. 이 집은 남쪽 땅의 방식을 따르지 않고, 가운데 땅의 방식으로 지어졌다. 안에 들어서면 작은 연못이 보인다.',
  '6': '이 마을에 세워진 첫 번째 악단의 거처이다. 지금의 모습은 첫 모습이 아니니, 다시 지어진 것은 전쟁이 끝난 뒤였다. 벽의 빛깔은 노을과 같고, 이 건물의 그림자는 해가 질 때 가장 길다.',
  '8': '겉으로는 동쪽 나라의 연회장이었으나, 속으로는 숨겨진 방이 있었다. 이 집의 주인은 두 개의 얼굴로 살았으니, 하나는 손님을 맞이하는 얼굴이요, 하나는 나라를 구하려는 얼굴이었다.',
  '10': '티 없이 결백한 마음, 소심당이라는 이름을 받은 여인이 이곳에 기려져 있다. 광주의 어머니라 불렸으니, 감옥에서 나온 뒤에도 다친 이들을 돌보았다. 그녀의 뿌리는 이 마을의 여학교에 있다.',
  '11': '사백 년을 산 나무가 이 마을의 선교 터에 서 있다. 이 나무의 열매는 붉어 겨울에도 빛나니, 온 나라가 이 열매의 모양을 사랑의 표식으로 삼았다. 따뜻한 남쪽 땅에서만 자라는 이 나무의 잎에는 가시가 있다.',
};

/**
 * ============================================================
 * ROUTE DESIGN V3 (9 locations, 정율성로 제외)
 * ============================================================
 * Center: 35.140252, 126.912400
 *
 * Round 1: Teams 1-5 (동시 출발)
 * Round 2: Teams 6-10 (동시 출발)
 *
 * Constraints satisfied:
 * - 같은 단계에 같은 장소를 방문하는 팀 없음
 * - 총 이동시간 15.1~15.4분 (편차 0.3분)
 * - 정답/오답 쌍 최소 175m 이상 이격
 * - 오웬기념각<->양림교회 (32m), 호랑가시나무<->우일선사택 (52m)
 *   쌍은 정답/오답으로 사용하지 않음
 * ============================================================
 */

/**
 * Team 1 route (Round 1)
 * 양림교회 → 최승효가옥 → 오웬기념각 | 1133m / 15.1min
 */
const TEAM_1_ROUTE: TeamRoute = {
  teamId: 1,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '11',
      correctPhoto: 'step_T1_S1_correct.jpg',
      wrongPhoto: 'step_T1_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '11',
      correctPhoto: 'step_T1_S2_correct.jpg',
      wrongPhoto: 'step_T1_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '8',
      correctPhoto: 'step_T1_S3_correct.jpg',
      wrongPhoto: 'step_T1_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T1.jpg',
};

/**
 * Team 2 route (Round 1)
 * 펭귄마을 → 양림교회 → 호랑가시나무 | 1130m / 15.1min
 */
const TEAM_2_ROUTE: TeamRoute = {
  teamId: 2,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '11',
      correctPhoto: 'step_T2_S1_correct.jpg',
      wrongPhoto: 'step_T2_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '5',
      correctPhoto: 'step_T2_S2_correct.jpg',
      wrongPhoto: 'step_T2_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['11'],
      correctLocation: '11',
      wrongLocation: '6',
      correctPhoto: 'step_T2_S3_correct.jpg',
      wrongPhoto: 'step_T2_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T2.jpg',
};

/**
 * Team 3 route (Round 1)
 * 조아라기념관 → 선교사묘역 → 펭귄마을 | 1152m / 15.4min
 */
const TEAM_3_ROUTE: TeamRoute = {
  teamId: 3,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['10'],
      correctLocation: '10',
      wrongLocation: '8',
      correctPhoto: 'step_T3_S1_correct.jpg',
      wrongPhoto: 'step_T3_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '8',
      correctPhoto: 'step_T3_S2_correct.jpg',
      wrongPhoto: 'step_T3_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '3',
      correctPhoto: 'step_T3_S3_correct.jpg',
      wrongPhoto: 'step_T3_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T3.jpg',
};

/**
 * Team 4 route (Round 1)
 * 우일선사택 → 펭귄마을 → 조아라기념관 | 1134m / 15.1min
 */
const TEAM_4_ROUTE: TeamRoute = {
  teamId: 4,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '8',
      correctPhoto: 'step_T4_S1_correct.jpg',
      wrongPhoto: 'step_T4_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '8',
      correctPhoto: 'step_T4_S2_correct.jpg',
      wrongPhoto: 'step_T4_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['10'],
      correctLocation: '10',
      wrongLocation: '5',
      correctPhoto: 'step_T4_S3_correct.jpg',
      wrongPhoto: 'step_T4_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T4.jpg',
};

/**
 * Team 5 route (Round 1)
 * 오웬기념각 → 우일선사택 → 최승효가옥 | 1138m / 15.2min
 */
const TEAM_5_ROUTE: TeamRoute = {
  teamId: 5,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '5',
      correctPhoto: 'step_T5_S1_correct.jpg',
      wrongPhoto: 'step_T5_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '5',
      correctPhoto: 'step_T5_S2_correct.jpg',
      wrongPhoto: 'step_T5_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '1',
      correctPhoto: 'step_T5_S3_correct.jpg',
      wrongPhoto: 'step_T5_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T5.jpg',
};

/**
 * Team 6 route (Round 2)
 * 펭귄마을 → 오웬기념각 → 호랑가시나무 | 1134m / 15.1min
 */
const TEAM_6_ROUTE: TeamRoute = {
  teamId: 6,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '11',
      correctPhoto: 'step_T6_S1_correct.jpg',
      wrongPhoto: 'step_T6_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '4',
      correctPhoto: 'step_T6_S2_correct.jpg',
      wrongPhoto: 'step_T6_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['11'],
      correctLocation: '11',
      wrongLocation: '2',
      correctPhoto: 'step_T6_S3_correct.jpg',
      wrongPhoto: 'step_T6_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T6.jpg',
};

/**
 * Team 7 route (Round 2)
 * 우일선사택 → 펭귄마을 → 조아라기념관 | 1134m / 15.1min
 */
const TEAM_7_ROUTE: TeamRoute = {
  teamId: 7,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '8',
      correctPhoto: 'step_T7_S1_correct.jpg',
      wrongPhoto: 'step_T7_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '2',
      correctPhoto: 'step_T7_S2_correct.jpg',
      wrongPhoto: 'step_T7_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['10'],
      correctLocation: '10',
      wrongLocation: '5',
      correctPhoto: 'step_T7_S3_correct.jpg',
      wrongPhoto: 'step_T7_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T7.jpg',
};

/**
 * Team 8 route (Round 2)
 * 최승효가옥 → 선교사묘역 → 펭귄마을 | 1131m / 15.1min
 */
const TEAM_8_ROUTE: TeamRoute = {
  teamId: 8,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '10',
      correctPhoto: 'step_T8_S1_correct.jpg',
      wrongPhoto: 'step_T8_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '10',
      correctPhoto: 'step_T8_S2_correct.jpg',
      wrongPhoto: 'step_T8_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '10',
      correctPhoto: 'step_T8_S3_correct.jpg',
      wrongPhoto: 'step_T8_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T8.jpg',
};

/**
 * Team 9 route (Round 2)
 * 오웬기념각 → 우일선사택 → 최승효가옥 | 1138m / 15.2min
 */
const TEAM_9_ROUTE: TeamRoute = {
  teamId: 9,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '11',
      correctPhoto: 'step_T9_S1_correct.jpg',
      wrongPhoto: 'step_T9_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '8',
      correctPhoto: 'step_T9_S2_correct.jpg',
      wrongPhoto: 'step_T9_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '3',
      correctPhoto: 'step_T9_S3_correct.jpg',
      wrongPhoto: 'step_T9_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T9.jpg',
};

/**
 * Team 10 route (Round 2)
 * 양림교회 → 최승효가옥 → 우일선사택 | 1137m / 15.2min
 */
const TEAM_10_ROUTE: TeamRoute = {
  teamId: 10,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '11',
      correctPhoto: 'step_T10_S1_correct.jpg',
      wrongPhoto: 'step_T10_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '10',
      correctPhoto: 'step_T10_S2_correct.jpg',
      wrongPhoto: 'step_T10_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '1',
      correctPhoto: 'step_T10_S3_correct.jpg',
      wrongPhoto: 'step_T10_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T10.jpg',
};

const TEAM_ROUTES: Record<number, TeamRoute> = {
  1: TEAM_1_ROUTE,
  2: TEAM_2_ROUTE,
  3: TEAM_3_ROUTE,
  4: TEAM_4_ROUTE,
  5: TEAM_5_ROUTE,
  6: TEAM_6_ROUTE,
  7: TEAM_7_ROUTE,
  8: TEAM_8_ROUTE,
  9: TEAM_9_ROUTE,
  10: TEAM_10_ROUTE,
};

/**
 * Helper function to get location by ID
 */
export function getLocation(locationId: string): Location | undefined {
  return LOCATIONS.find((loc) => loc.id === locationId);
}

/**
 * Helper function to get all locations
 */
export function getAllLocations(): Location[] {
  return LOCATIONS;
}

/**
 * Helper function to get team route
 */
export function getTeamRoute(teamId: number): TeamRoute | undefined {
  return TEAM_ROUTES[teamId];
}

/**
 * Helper function to get team's round (1 or 2)
 */
export function getTeamRound(teamId: number): 1 | 2 {
  if (teamId >= 1 && teamId <= 5) {
    return 1;
  }
  return 2;
}
