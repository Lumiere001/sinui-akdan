import { motion } from 'framer-motion'
import { useTimer } from '../hooks/useTimer'

interface TimerProps {
  startTime: number | null
  duration: number
  onExpire?: () => void
}

export function Timer({ startTime, duration, onExpire }: TimerProps) {
  const { minutes, seconds, isExpired, progress } = useTimer(startTime, duration)

  const isUrgent = minutes === 0 && seconds < 60
  const isWarning = progress < 1 / 6

  if (isExpired && onExpire) {
    onExpire()
  }

  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const circumference = 2 * Math.PI * 20
  const strokeColor = isWarning ? '#ef4444' : '#d4a853'
  const glowClass = isWarning ? 'glow-red' : 'glow-gold'

  return (
    <motion.div
      className={`flex items-center gap-3 px-4 py-2 rounded-2xl glass ${glowClass}`}
      animate={isUrgent ? { scale: [1, 1.03, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.8 }}
    >
      {/* Mini circular progress */}
      <div className="relative w-10 h-10">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="2.5"
          />
          <motion.circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${strokeColor}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold" style={{ color: strokeColor }}>
            {Math.ceil(progress * 100)}%
          </span>
        </div>
      </div>

      {/* Time display */}
      <div>
        <span
          className="text-xl font-extrabold tracking-wider tabular-nums"
          style={{ color: strokeColor }}
        >
          {displayTime}
        </span>
        <p className="text-[10px] text-gray-500 font-medium">남은 시간</p>
      </div>
    </motion.div>
  )
}