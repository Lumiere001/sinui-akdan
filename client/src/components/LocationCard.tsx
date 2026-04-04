import { motion } from 'framer-motion'
import { MapPin, Navigation, Users, CheckCircle } from 'lucide-react'
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
    far: {
      label: '멀리',
      dotColor: 'bg-gray-500',
      textColor: 'text-gray-400',
      borderClass: 'border-white/[0.04]',
      bgClass: 'glass',
    },
    approaching: {
      label: '접근중',
      dotColor: 'bg-amber-400',
      textColor: 'text-amber-400',
      borderClass: 'border-amber-400/20',
      bgClass: 'glass-gold',
    },
    arrived: {
      label: '도착',
      dotColor: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      borderClass: 'border-emerald-400/20',
      bgClass: '',
    },
  }

  const config = statusConfig[status]

  const formatDistance = (d: number) => {
    if (d === Infinity) return '--'
    if (d >= 1000) return `${(d / 1000).toFixed(1)}km`
    return `${Math.round(d)}m`
  }

  return (
    <motion.div
      layout
      className={`w-full rounded-2xl overflow-hidden transition-all duration-300 ${
        canCheck
          ? 'bg-emerald-500/[0.08] border border-emerald-400/20 glow-emerald'
          : `${config.bgClass} ${config.borderClass}`
      }`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 0.995 }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Location name & status */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                status === 'arrived' ? 'bg-emerald-400/15' :
                status === 'approaching' ? 'bg-amber-400/10' :
                'bg-white/[0.04]'
              }`}>
                <MapPin className={`w-4 h-4 ${
                  status === 'arrived' ? 'text-emerald-400' :
                  status === 'approaching' ? 'text-amber-400' :
                  'text-gray-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-[15px] truncate">{location.name}</h3>
              </div>
            </div>

            {/* Info row */}
            <div className="flex items-center gap-3 ml-[42px]">
              {/* Distance */}
              <div className="flex items-center gap-1.5 text-xs">
                <Navigation className="w-3.5 h-3.5 text-blue-400/70" />
                <span className="text-gray-400 tabular-nums font-medium">{formatDistance(distance)}</span>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${status !== 'far' ? 'pulse-dot' : ''}`} />
                <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
              </div>

              {/* Member count when arrived */}
              {status === 'arrived' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5 text-gray-500" />
                  <span className={`font-medium tabular-nums ${memberCount >= membersNeeded ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {memberCount}/{membersNeeded}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Check-in button */}
          <motion.button
            disabled={!canCheck || isCheckingIn}
            onClick={onCheck}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs whitespace-nowrap transition-all duration-200 ${
              canCheck
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20 cursor-pointer'
                : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
            }`}
            whileHover={canCheck ? { scale: 1.05 } : {}}
            whileTap={canCheck ? { scale: 0.95 } : {}}
          >
            {isCheckingIn ? (
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isCheckingIn ? '확인중' : '확인'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}