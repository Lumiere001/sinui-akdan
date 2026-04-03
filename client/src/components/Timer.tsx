import { motion } from 'framer-motion'
import { useTimer } from '../hooks/useTimer'

interface TimerProps {
  startTime: number | null
  duration: number
  onExpire?: () => void
}

export function Timer({ startTime, duration, onExpire }: TimerProps) {
  const { minutes, seconds, isExpired, progress } = useTimer(startTime, duration)

  const isPulsing = minutes === 0 && seconds < 60
  const isWarning = progress < 1 / 6

  if (isExpired && onExpire) {
    onExpire()
  }

  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      animate={isPulsing ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1 }}
    >
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#1a2541"
            strokeWidth="2"
          />
          {/* Progress ring */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isWarning ? '#dc2626' : '#d4a853'}
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
            strokeLinecap="round"
          />
        </svg>

        {/* Time text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-2xl font-bold ${
              isWarning ? 'text-red-500' : 'text-gold'
            }`}
          >
            {displayTime}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-400">남은 시간</div>
    </motion.div>
  )
}
