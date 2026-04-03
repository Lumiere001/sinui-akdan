import { useEffect, useState } from 'react'

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

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'GPS 기능을 지원하지 않는 기기입니다',
      }))
      return
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }))

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState({
          position: {
            lat: latitude,
            lng: longitude,
            accuracy,
          },
          error: null,
          isTracking: true,
        })
      },
      (error) => {
        let errorMessage = 'GPS 오류가 발생했습니다'
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = '위치 접근 권한이 거부되었습니다'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = '위치 정보를 사용할 수 없습니다'
        } else if (error.code === error.TIMEOUT) {
          errorMessage = '위치 정보 요청 시간 초과'
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return state
}
