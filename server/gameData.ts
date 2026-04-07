import type { Location, TeamRoute, RouteStep } from './shared/types.js';

/**
 * All 7 locations in Yanglim Village (양림마을)
 * Location 7 (김현승 시비) has been removed for V2
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
  '8': '겉으로는 동쪽 나라의 연회장이었으나, 속으로는 숨겨진 방이 있었다. 이 집의 주인은 두 개의 얼굴로 살았으니, 하나는 손님을 맞이하는 얼굴이요, 하나는 나라를 구하려는 얼굴이었다.',
};

/**
 * Team 1 route (Round 1)
 * Step 1: 1→3, Step 2: 4→5, Step 3: 8→2
 */
const TEAM_1_ROUTE: TeamRoute = {
  teamId: 1,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '3',
      correctPhoto: 'step_T1_S1_correct.jpg',
      wrongPhoto: 'step_T1_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '5',
      correctPhoto: 'step_T1_S2_correct.jpg',
      wrongPhoto: 'step_T1_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '2',
      correctPhoto: 'step_T1_S3_correct.jpg',
      wrongPhoto: 'step_T1_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T1.jpg',
};

/**
 * Team 2 route (Round 1)
 * Step 1: 3→1, Step 2: 5→4, Step 3: 2→8
 */
const TEAM_2_ROUTE: TeamRoute = {
  teamId: 2,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '1',
      correctPhoto: 'step_T2_S1_correct.jpg',
      wrongPhoto: 'step_T2_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['5'],
      correctLocation: '5',
      wrongLocation: '4',
      correctPhoto: 'step_T2_S2_correct.jpg',
      wrongPhoto: 'step_T2_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '8',
      correctPhoto: 'step_T2_S3_correct.jpg',
      wrongPhoto: 'step_T2_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T2.jpg',
};

/**
 * Team 3 route (Round 1)
 * Step 1: 6→3, Step 2: 8→4, Step 3: 5→2
 */
const TEAM_3_ROUTE: TeamRoute = {
  teamId: 3,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '3',
      correctPhoto: 'step_T3_S1_correct.jpg',
      wrongPhoto: 'step_T3_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '4',
      correctPhoto: 'step_T3_S2_correct.jpg',
      wrongPhoto: 'step_T3_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['5'],
      correctLocation: '5',
      wrongLocation: '2',
      correctPhoto: 'step_T3_S3_correct.jpg',
      wrongPhoto: 'step_T3_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T3.jpg',
};

/**
 * Team 4 route (Round 1)
 * Step 1: 4→8, Step 2: 6→5, Step 3: 1→3
 */
const TEAM_4_ROUTE: TeamRoute = {
  teamId: 4,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '8',
      correctPhoto: 'step_T4_S1_correct.jpg',
      wrongPhoto: 'step_T4_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '5',
      correctPhoto: 'step_T4_S2_correct.jpg',
      wrongPhoto: 'step_T4_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '3',
      correctPhoto: 'step_T4_S3_correct.jpg',
      wrongPhoto: 'step_T4_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T4.jpg',
};

/**
 * Team 5 route (Round 1)
 * Step 1: 5→2, Step 2: 3→6, Step 3: 4→8
 */
const TEAM_5_ROUTE: TeamRoute = {
  teamId: 5,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['5'],
      correctLocation: '5',
      wrongLocation: '2',
      correctPhoto: 'step_T5_S1_correct.jpg',
      wrongPhoto: 'step_T5_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '6',
      correctPhoto: 'step_T5_S2_correct.jpg',
      wrongPhoto: 'step_T5_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '8',
      correctPhoto: 'step_T5_S3_correct.jpg',
      wrongPhoto: 'step_T5_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T5.jpg',
};

/**
 * Team 6 route (Round 2)
 * Step 1: 2→6, Step 2: 1→5, Step 3: 8→4
 */
const TEAM_6_ROUTE: TeamRoute = {
  teamId: 6,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '6',
      correctPhoto: 'step_T6_S1_correct.jpg',
      wrongPhoto: 'step_T6_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '5',
      correctPhoto: 'step_T6_S2_correct.jpg',
      wrongPhoto: 'step_T6_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '4',
      correctPhoto: 'step_T6_S3_correct.jpg',
      wrongPhoto: 'step_T6_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T6.jpg',
};

/**
 * Team 7 route (Round 2)
 * Step 1: 8→5, Step 2: 2→3, Step 3: 6→1
 */
const TEAM_7_ROUTE: TeamRoute = {
  teamId: 7,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '5',
      correctPhoto: 'step_T7_S1_correct.jpg',
      wrongPhoto: 'step_T7_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '3',
      correctPhoto: 'step_T7_S2_correct.jpg',
      wrongPhoto: 'step_T7_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '1',
      correctPhoto: 'step_T7_S3_correct.jpg',
      wrongPhoto: 'step_T7_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T7.jpg',
};

/**
 * Team 8 route (Round 2)
 * Step 1: 5→8, Step 2: 3→2, Step 3: 1→6
 */
const TEAM_8_ROUTE: TeamRoute = {
  teamId: 8,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['5'],
      correctLocation: '5',
      wrongLocation: '8',
      correctPhoto: 'step_T8_S1_correct.jpg',
      wrongPhoto: 'step_T8_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['3'],
      correctLocation: '3',
      wrongLocation: '2',
      correctPhoto: 'step_T8_S2_correct.jpg',
      wrongPhoto: 'step_T8_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['1'],
      correctLocation: '1',
      wrongLocation: '6',
      correctPhoto: 'step_T8_S3_correct.jpg',
      wrongPhoto: 'step_T8_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T8.jpg',
};

/**
 * Team 9 route (Round 2)
 * Step 1: 6→4, Step 2: 5→8, Step 3: 2→1
 */
const TEAM_9_ROUTE: TeamRoute = {
  teamId: 9,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['6'],
      correctLocation: '6',
      wrongLocation: '4',
      correctPhoto: 'step_T9_S1_correct.jpg',
      wrongPhoto: 'step_T9_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['5'],
      correctLocation: '5',
      wrongLocation: '8',
      correctPhoto: 'step_T9_S2_correct.jpg',
      wrongPhoto: 'step_T9_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['2'],
      correctLocation: '2',
      wrongLocation: '1',
      correctPhoto: 'step_T9_S3_correct.jpg',
      wrongPhoto: 'step_T9_S3_wrong.jpg',
    },
  ],
  finalPhoto: 'final_T9.jpg',
};

/**
 * Team 10 route (Round 2)
 * Step 1: 4→6, Step 2: 8→3, Step 3: 5→1
 */
const TEAM_10_ROUTE: TeamRoute = {
  teamId: 10,
  steps: [
    {
      stepNumber: 1,
      hint: HINTS['4'],
      correctLocation: '4',
      wrongLocation: '6',
      correctPhoto: 'step_T10_S1_correct.jpg',
      wrongPhoto: 'step_T10_S1_wrong.jpg',
    },
    {
      stepNumber: 2,
      hint: HINTS['8'],
      correctLocation: '8',
      wrongLocation: '3',
      correctPhoto: 'step_T10_S2_correct.jpg',
      wrongPhoto: 'step_T10_S2_wrong.jpg',
    },
    {
      stepNumber: 3,
      hint: HINTS['5'],
      correctLocation: '5',
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
