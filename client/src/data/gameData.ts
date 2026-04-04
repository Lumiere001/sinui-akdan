import type { Location, TeamConfig } from '../../../shared/types'

// ========== 8개 장소 (서버와 동일) ==========
export const LOCATIONS: Location[] = [
  { id: '1', name: '오웬기념각',       lat: 35.14350, lng: 126.91550, unlockRadius: 40, approachRadius: 100 },
  { id: '2', name: '선교사 묘역',      lat: 35.14450, lng: 126.91480, unlockRadius: 40, approachRadius: 100 },
  { id: '3', name: '우일선 선교사 사택', lat: 35.14400, lng: 126.91400, unlockRadius: 40, approachRadius: 100 },
  { id: '4', name: '펭귄마을 입구',     lat: 35.14200, lng: 126.91550, unlockRadius: 40, approachRadius: 100 },
  { id: '5', name: '이장우 가옥',       lat: 35.14320, lng: 126.91450, unlockRadius: 40, approachRadius: 100 },
  { id: '6', name: '양림교회',          lat: 35.14370, lng: 126.91520, unlockRadius: 40, approachRadius: 100 },
  { id: '7', name: '김현승 시비',       lat: 35.14430, lng: 126.91460, unlockRadius: 40, approachRadius: 100 },
  { id: '8', name: '최승효 가옥',       lat: 35.14300, lng: 126.91420, unlockRadius: 40, approachRadius: 100 },
]

// ========== 힌트 (서버 gameData와 동일) ==========
export const HINTS: Record<string, string> = {
  '1': '이곳에서 소리가 처음 울렸다. 하나의 무대에 두 개의 문이 있으니, 들어가는 길이 나뉘어 있었으되 듣는 곡은 하나였다. 벽의 빛깔은 하늘이 흐린 날과 같다.',
  '2': '연주를 마치고 악기를 내려놓은 이들이 모인 곳이다. 스물 둘의 이름이 돌 위에 새겨져 있으며, 배움의 터 안에 이 언덕이 있다. 이국의 풀이 그들 곁에 자란다.',
  '3': '병을 고치던 자가 살던 집이다. 이 마을의 서양 가옥 중 가장 오래 서 있으니, 백 년을 넘긴 벽이 아직 따뜻하다. 이 집의 주인은 다른 이의 이름으로 불렸다.',
  '4': '이곳은 누가 시킨 것이 아니다. 사는 이들이 스스로 만든 무대이며, 골목 하나하나가 작품이다. 큰 건물이 아니라 좁은 길 사이에서 이 장소를 찾아라.',
  '5': '큰 문은 닫혀 있으나 들어갈 수 없는 것은 아니다. 왼편에 작은 문이 있다. 이 집은 남쪽 땅의 방식을 따르지 않고, 서울의 방식으로 지어졌다. 안에 들어서면 동쪽 나라의 정원이 보인다.',
  '6': '이 마을에 세워진 첫 번째 악단의 거처이다. 지금의 모습은 첫 모습이 아니니, 다시 지어진 것은 전쟁이 끝난 뒤였다. 벽의 빛깔은 노을과 같고, 그 앞에 사백 년을 산 나무가 서 있다.',
  '7': '악보가 아니라 시(詩)가 새겨진 돌이다. 이 돌을 남긴 자는 가을에 기도했고, 배움의 터 언덕길을 걸으며 곡을 떠올렸다. 그의 아버지는 이 마을에서 악단을 이끌었다.',
  '8': '겉으로는 동쪽 나라의 연회장이었으나, 속으로는 숨겨진 방이 있었다. 이 집의 주인은 두 개의 얼굴로 살았으니, 하나는 손님을 맞이하는 얼굴이요, 하나는 나라를 구하려는 얼굴이었다.',
}

// ========== 라운드별 팀 설정 (서버와 동일) ==========
// 라운드 1: 팀 1~5
const ROUND_1_TEAMS: Record<number, TeamConfig> = {
  1:  { teamId: 1,  visibleLocations: ['1','3','5','6','8'], correctLocation: '1', hint: HINTS['1'], correctPhoto: 'score_11.jpg', wrongPhoto: 'score_11.jpg' },
  2:  { teamId: 2,  visibleLocations: ['1','3','4','5','7'], correctLocation: '3', hint: HINTS['3'], correctPhoto: 'score_12.jpg', wrongPhoto: 'score_12.jpg' },
  3:  { teamId: 3,  visibleLocations: ['2','3','5','7','8'], correctLocation: '5', hint: HINTS['5'], correctPhoto: 'score_13.jpg', wrongPhoto: 'score_13.jpg' },
  4:  { teamId: 4,  visibleLocations: ['1','4','6','7','8'], correctLocation: '7', hint: HINTS['7'], correctPhoto: 'score_14.jpg', wrongPhoto: 'score_14.jpg' },
  5:  { teamId: 5,  visibleLocations: ['2','4','5','6','8'], correctLocation: '4', hint: HINTS['4'], correctPhoto: 'score_15.jpg', wrongPhoto: 'score_15.jpg' },
}

// 라운드 2: 팀 6~10
const ROUND_2_TEAMS: Record<number, TeamConfig> = {
  6:  { teamId: 6,  visibleLocations: ['2','4','6','7','8'], correctLocation: '2', hint: HINTS['2'], correctPhoto: 'score_16.jpg', wrongPhoto: 'score_16.jpg' },
  7:  { teamId: 7,  visibleLocations: ['1','3','5','6','8'], correctLocation: '6', hint: HINTS['6'], correctPhoto: 'score_17.jpg', wrongPhoto: 'score_17.jpg' },
  8:  { teamId: 8,  visibleLocations: ['2','3','5','7','8'], correctLocation: '8', hint: HINTS['8'], correctPhoto: 'score_18.jpg', wrongPhoto: 'score_18.jpg' },
  9:  { teamId: 9,  visibleLocations: ['1','4','5','6','7'], correctLocation: '5', hint: HINTS['5'], correctPhoto: 'score_19.jpg', wrongPhoto: 'score_19.jpg' },
  10: { teamId: 10, visibleLocations: ['1','2','4','6','8'], correctLocation: '1', hint: HINTS['1'], correctPhoto: 'score_20.jpg', wrongPhoto: 'score_20.jpg' },
}

// ========== 팀 비밀번호 ==========
export const TEAM_PASSWORDS: Record<number, string> = {
  1: '1111', 2: '2222', 3: '3333', 4: '4444', 5: '5555',
  6: '6666', 7: '7777', 8: '8888', 9: '9999', 10: '0000',
}

// ========== 헬퍼 함수 ==========

export function validateTeamLogin(teamId: number, password: string): boolean {
  return TEAM_PASSWORDS[teamId] === password
}

export function getTeamRound(teamId: number): 1 | 2 {
  return teamId <= 5 ? 1 : 2
}

export function getTeamConfig(teamId: number): TeamConfig | undefined {
  if (teamId <= 5) return ROUND_1_TEAMS[teamId]
  return ROUND_2_TEAMS[teamId]
}

export function getTeamVisibleLocations(teamId: number): Location[] {
  const config = getTeamConfig(teamId)
  if (!config) return []
  return config.visibleLocations
    .map((id) => LOCATIONS.find((loc) => loc.id === id))
    .filter((loc): loc is Location => loc !== undefined)
}

export function getTeamHint(teamId: number): string {
  const config = getTeamConfig(teamId)
  return config?.hint ?? ''
}

export function getLocationById(id: string): Location | undefined {
  return LOCATIONS.find((loc) => loc.id === id)
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getDirectionBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180)
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
