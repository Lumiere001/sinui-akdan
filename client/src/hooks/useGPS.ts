import { useEffect, useState, useRef, useCallback } from 'react'

export interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
}

export interface GPSState {
  position: GPSPosition | null
  error: string | null
  isTracking: boolean
}

export function useGPS() {
  const [state, setState] = useState<GPSState>({
    position: null,
    error: null,
    isTracking: false,
  })
  const watchIdRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPositionRef = useRef<GPSPosition | null>(null)

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'GPS 기능을 지원하지 않는 기기입니다',
      }))
      return
    }

    // Clear existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        retryCountRef.current = 0 // Reset retry count on success

        const newPosition = {
          lat: latitude,
          lng: longitude,
          accuracy,
        }
        lastPositionRef.current = newPosition

        setState({
          position: newPosition,
          error: null,
          isTracking: true,
        })
      },
      (error) => {
        let errorMessage = 'GPS 오류가 발생했습니다'
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = '위치 접근 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.'
          setState((prev) => ({
            ...prev,
            error: errorMessage,
            isTracking: false,
          }))
          return // Don't retry on permission denied
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = '위치 정보를 사용할 수 없습니다. 재시도 중...'
        } else if (error.code === error.TIMEOUT) {
          errorMessage = '위치 정보 요청 시간 초과. 재시도 중...'
        }

        // Keep last known position while retrying
        setState((prev) => ({
          ...prev,
          position: lastPositionRef.current || prev.position,
          error: errorMessage,
          isTracking: lastPositionRef.current !== null,
        }))

        // Auto-retry with backoff (max 5 retries, then restart watch)
        if (retryCountRef.current < 5) {
          retryCountRef.current++
          const backoff = Math.min(2000 * retryCountRef.current, 10000)
          retryTimerRef.current = setTimeout(() => {
            startWatching()
          }, backoff)
        } else {
          // After 5 retries, wait longer then try fresh
          retryCountRef.current = 0
          retryTimerRef.current = setTimeout(() => {
            startWatching()
          }, 15000)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    )
  }, [])

  useEffect(() => {
    startWatching()

    // Periodic fallback: if no update in 30s, try getCurrentPosition
    const fallbackInterval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords
            const newPosition = { lat: latitude, lng: longitude, accuracy }
            lastPositionRef.current = newPosition
            setState((prev) => ({
              ...prev,
              position: newPosition,
              isTracking: true,
              error: null,
            }))
          },
          () => {
            // Silently ignore fallback errors
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 10000,
          }
        )
      }
    }, 30000)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      clearInterval(fallbackInterval)
    }
  }, [startWatching])

  return state
}