import { motion } from 'framer-motion'
import { MapPin, Navigation } from 'lucide-react'
import type { Location } from '../../../shared/types'
import { calculateDistance } from '../data/gameData'

interface LocationCardProps {
  location: Location
  playerLat: number | null
  playerLng: number | null
  memberCount?: number
  membersNeeded?: number
  isCheckingIn?: boolean
  onCheck?: () => void
}

export function LocationCard({
  location,
  playerLat,
  playerLng,
  memberCount = 0,
  membersNeeded = 3,
  isCheckingIn = false,
  onCheck,
}: LocationCardProps) {
  let distance = Infinity
  let status: 'far' | 'approaching' | 'arrived' = 'far'

  if (playerLat && playerLng) {
    distance = calculateDistance(playerLat, playerLng, location.lat, location.lng)

    if (distance <= location.unlockRadius) {
      status = 'arrived'
    } else if (distance <= location.approachRadius) {
      status = 'approaching'
    }
  }

  const canCheck = status === 'arrived' && memberCount >= membersNeeded

  const statusConfig = {
    far: { label: '멀리', color: 'text-gray-400', bg: 'bg-gray-900/40' },
    approaching: { label: '접근중', color: 'text-amber-400', bg: 'bg-amber-900/30' },
    arrived: { label: '도착', color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  }

  const config = statusConfig[status]

  return (
    <motion.div
      layout
      className={`w-full p-4 rounded-lg border transition-all ${
        canCheck
          ? 'bg-emerald-900/20 border-emerald-600/40'
          : 'bg-slate-900/40 border-slate-700/40'
      }`}
      whileHover={{ scale: 0.99 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-gold" />
            <h3 className="font-semibold text-white text-base">{location.name}</h3>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-300">
            <div className="flex items-center gap-1">
              <Navigation className="w-4 h-4 text-blue-400" />
              <span>{Math.round(distance)}m</span>
            </div>

            <div className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
              {config.label}
            </div>
          </div>

          {status === 'arrived' && (
            <div className="mt-2 text-xs text-gray-400">
              인원: <span className={memberCount >= membersNeeded ? 'text-emerald-400' : 'text-amber-400'}>
                {memberCount}/{membersNeeded}
              </span>
            </div>
          )}
        </div>

        <motion.button
          disabled={!canCheck || isCheckingIn}
          onClick={onCheck}
          className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
            canCheck
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
          }`}
          whileHover={canCheck ? { scale: 1.05 } : {}}
          whileTap={canCheck ? { scale: 0.95 } : {}}
        >
          {isCheckingIn ? '확인 중...' : '확인하기'}
        </motion.button>
      </div>
    </motion.div>
  )
}
