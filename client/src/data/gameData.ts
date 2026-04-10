import type { Location } from '../../../shared/types'

// ========== 7개 장소 (서버와 동일, 김현승 시비 제거) ==========
export const LOCATIONS: Location[] = [
  { id: '1', name: '오웬기념각',       lat: 35.138299, lng: 126.915901, unlockRadius: 40, approachRadius: 100 },
  { id: '2', name: '선교사 묘역',      lat: 35.139354, lng: 126.911123, unlockRadius: 40, approachRadius: 100 },
  { id: '3', name: '우일선 선교사 사택', lat: 35.138358, lng: 126.911861, unlockRadius: 40, approachRadius: 100 },
  { id: '4', name: '펭귄마을',          lat: 35.140536, lng: 126.917556, unlockRadius: 40, approachRadius: 100 },
  { id: '5', name: '이장우 가옥',       lat: 35.140423, lng: 126.914215, unlockRadius: 40, approachRadius: 100 },
  { id: '6', name: '양림교회',          lat: 35.138181, lng: 126.915584, unlockRadius: 40, approachRadius: 100 },
  { id: '8', name: '최승효 가옥',       lat: 35.141354, lng: 126.913985, unlockRadius: 40, approachRadius: 100 },
  { id: '10', name: '조아라 기념관',    lat: 35.138778, lng: 126.914419, unlockRadius: 40, approachRadius: 100 },
  { id: '11', name: '호랑가시나무',     lat: 35.137888, lng: 126.911828, unlockRadius: 40, approachRadius: 100 },
]

// ========== 팀 이름 (오케스트라 악기) ==========
export const TEAM_NAMES: Record<number, string> = {
  1: '바이올린',
  2: '비올라',
  3: '첼로',
  4: '더블베이스',
  5: '플루트',
  6: '오보에',
  7: '클라리넷',
  8: '호른',
  9: '트럼펫',
  10: '팀파니',
}

// ========== 팀 비밀번호 (4자리 무작위) ==========
export const TEAM_PASSWORDS: Record<number, string> = {
  1: '3847',
  2: '5291',
  3: '7463',
  4: '1926',
  5: '8052',
  6: '4739',
  7: '6185',
  8: '2574',
  9: '9318',
  10: '5607',
}

export function getTeamName(teamId: number): string {
  return TEAM_NAMES[teamId] || `팀 ${teamId}`
}

export function getTeamLabel(teamId: number): string {
  const name = TEAM_NAMES[teamId]
  return name ? `${teamId}팀 · ${name}` : `팀 ${teamId}`
}

// ========== 헬퍼 함수 ==========

export function validateTeamLogin(teamId: number, password: string): boolean {
  return TEAM_PASSWORDS[teamId] === password
}

export function getTeamRound(teamId: number): 1 | 2 {
  return teamId <= 5 ? 1 : 2
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
