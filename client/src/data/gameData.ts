import type { Location } from '../../../shared/types'

export const LOCATIONS: Location[] = [
  {
    id: '1',
    name: '오웬기념각',
    lat: 35.14350,
    lng: 126.91550,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '2',
    name: '선교사 묘역',
    lat: 35.14450,
    lng: 126.91480,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '3',
    name: '우일선 선교사 사택',
    lat: 35.14400,
    lng: 126.91400,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '4',
    name: '펭귄마을 입구',
    lat: 35.14200,
    lng: 126.91550,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '5',
    name: '이장우 가옥',
    lat: 35.14320,
    lng: 126.91450,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '6',
    name: '양림교회',
    lat: 35.14370,
    lng: 126.91520,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '7',
    name: '김현승 시비',
    lat: 35.14430,
    lng: 126.91460,
    unlockRadius: 50,
    approachRadius: 150,
  },
  {
    id: '8',
    name: '최승효 가옥',
    lat: 35.14300,
    lng: 126.91420,
    unlockRadius: 50,
    approachRadius: 150,
  },
]

export function getLocationById(id: string): Location | undefined {
  return LOCATIONS.find((loc) => loc.id === id)
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function getDirectionBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180)
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  const bearing = (Math.atan2(y, x) * 180) / Math.PI

  return (bearing + 360) % 360
}
