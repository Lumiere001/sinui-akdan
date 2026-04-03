import { useEffect, useState } from 'react'

export interface TimerState {
  minutes: number
  seconds: number
  isExpired: boolean
  progress: number
}

export function useTimer(startTime: number | null, duration: number) {
  const [timer, setTimer] = useState<TimerState>({
    minutes: 0,
    seconds: 0,
    isExpired: false,
    progress: 1,
  })

  useEffect(() => {
    if (!startTime) {
      setTimer({
        minutes: Math.floor(duration / 60000),
        seconds: Math.floor((duration % 60000) / 1000),
        isExpired: false,
        progress: 1,
      })
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - startTime
      const remaining = Math.max(0, duration - elapsed)

      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      const progress = remaining / duration

      setTimer({
        minutes,
        seconds,
        isExpired: remaining === 0,
        progress,
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, duration])

  return timer
}
