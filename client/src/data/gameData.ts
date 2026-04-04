import type { Location } from '../../../shared/types'

// ========== 8개 장소 (각 장소에 힌트 포함) ==========
export const LOCATIONS: Location[] = [
  {
    id: '1',
    name: '오웬기념각',
    lat: 35.14350,
    lng: 126.91550,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '선교사들의 헌신을 기억하는 벽돌 건물, 양림동 언덕 위에서 광주를 내려다보고 있어요.',
  },
  {
    id: '2',
    name: '선교사 묘역',
    lat: 35.14450,
    lng: 126.91480,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '이 땅을 사랑한 외국인들이 잠들어 있는 곳, 나무 그늘 아래 조용한 언덕을 찾아보세요.',
  },
  {
    id: '3',
    name: '우일선 선교사 사택',
    lat: 35.14400,
    lng: 126.91400,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '100년이 넘은 서양식 주택, 붉은 벽돌과 회색 지붕이 어우러진 아름다운 건물이에요.',
  },
  {
    id: '4',
    name: '펭귄마을 입구',
    lat: 35.14200,
    lng: 126.91550,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '알록달록한 벽화와 귀여운 펭귄 조형물이 반겨주는 마을 입구를 찾아보세요.',
  },
  {
    id: '5',
    name: '이장우 가옥',
    lat: 35.14320,
    lng: 126.91450,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '전통 한옥의 아름다움을 간직한 곳, 대문 앞 돌담길을 따라 걸어보세요.',
  },
  {
    id: '6',
    name: '양림교회',
    lat: 35.14370,
    lng: 126.91520,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '광주 최초의 교회, 높은 종탑이 하늘을 향해 서 있는 곳이에요.',
  },
  {
    id: '7',
    name: '김현승 시비',
    lat: 35.14430,
    lng: 126.91460,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '"가을에는 기도하게 하소서" 시인의 마음이 새겨진 돌을 찾아보세요.',
  },
  {
    id: '8',
    name: '최승효 가옥',
    lat: 35.14300,
    lng: 126.91420,
    unlockRadius: 50,
    approachRadius: 150,
    hint: '근대 한옥의 멋을 보여주는 집, 골목 안쪽 조용한 곳에 숨어 있어요.',
  },
]

// ========== 팀 정보 (10팀, 각 팀 5곳 배정) ==========
export interface TeamInfo {
  teamId: number
  password: string
  locationIds: string[]
}

export const TEAMS: TeamInfo[] = [
  { teamId: 1,  password: '1111', locationIds: ['1', '2', '3', '4', '5'] },
  { teamId: 2,  password: '2222', locationIds: ['2', '3', '4', '5', '6'] },
  { teamId: 3,  password: '3333', locationIds: ['3', '4', '5', '6', '7'] },
  { teamId: 4,  password: '4444', locationIds: ['4', '5', '6', '7', '8'] },
  { teamId: 5,  password: '5555', locationIds: ['5', '6', '7', '8', '1'] },
  { teamId: 6,  password: '6666', locationIds: ['6', '7', '8', '1', '2'] },
  { teamId: 7,  password: '7777', locationIds: ['7', '8', '1', '2', '3'] },
  { teamId: 8,  password: '8888', locationIds: ['8', '1', '2', '3', '4'] },
  { teamId: 9,  password: '9999', locationIds: ['1', '3', '5', '7', '8'] },
  { teamId: 10, password: '0000', locationIds: ['2', '4', '6', '7', '8'] },
]

// ========== 헬퍼 함수 ==========

export function getTeamByIdAndPassword(teamId: number, password: string): TeamInfo | undefined {
  return TEAMS.find((t) => t.teamId === teamId && t.password === password)
}

export function getTeamById(teamId: number): TeamInfo | undefined {
  return TEAMS.find((t) => t.teamId === teamId)
}

export function getTeamLocations(teamId: number): Location[] {
  const team = getTeamById(teamId)
  if (!team) return []
  return team.locationIds
    .map((id) => LOCATIONS.find((loc) => loc.id === id))
    .filter((loc): loc is Location => loc !== undefined)
}

export function getLocationById(id: string): Location | undefined {
  return LOCATIONS.find((loc) => loc.id === id)
}

export function calculateDistance(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371e3
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function getDirectionBearing(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180)
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
