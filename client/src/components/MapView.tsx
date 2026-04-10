import { useEffect, useRef, useState } from 'react'
import type { Location } from '../../../shared/types'

declare global {
  interface Window {
    kakao: any
  }
}

interface MapViewProps {
  locations: Location[]
  playerPosition: { lat: number; lng: number } | null
  teamMemberPositions?: { lat: number; lng: number }[]
  onLocationSelect?: (locationId: string) => void
}

export function MapView({
  locations,
  playerPosition,
  teamMemberPositions = [],
  onLocationSelect,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const playerMarkerRef = useRef<any>(null)
  const teamMemberMarkersRef = useRef<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [userDragged, setUserDragged] = useState(false)

  // Load Kakao Maps API
  useEffect(() => {
    if (window.kakao?.maps?.LatLng) {
      setMapLoaded(true)
      return
    }

    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(() => setMapLoaded(true))
      return
    }

    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]')
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.kakao?.maps?.load) {
          clearInterval(checkInterval)
          window.kakao.maps.load(() => setMapLoaded(true))
        }
      }, 200)
      setTimeout(() => clearInterval(checkInterval), 10000)
      return
    }

    const script = document.createElement('script')
    const apiKey = import.meta.env.VITE_KAKAO_MAP_KEY || '5cf7281a033392258ca9e620067aa6ad'
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`
    script.async = true

    script.onload = () => {
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => setMapLoaded(true))
      } else {
        setMapError(true)
      }
    }
    script.onerror = () => setMapError(true)
    document.head.appendChild(script)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return
    try {
      const { kakao } = window
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(playerPosition?.lat || 35.143, playerPosition?.lng || 126.915),
        level: 4,
      })
      mapInstanceRef.current = map
      kakao.maps.event.addListener(map, 'dragstart', () => {
        setUserDragged(true)
      })
      setTimeout(() => mapInstanceRef.current?.relayout(), 100)
    } catch (err) {
      console.error('Error initializing Kakao Map:', err)
      setMapError(true)
    }
  }, [mapLoaded])

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    const { kakao } = window
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    locations.forEach((location) => {
      const position = new kakao.maps.LatLng(location.lat, location.lng)
      const marker = new kakao.maps.Marker({
        position,
        title: location.name,
        image: createMarkerImage(location.id),
        clickable: true,
      })
      marker.setMap(mapInstanceRef.current)
      markersRef.current.set(location.id, marker)
      kakao.maps.event.addListener(marker, 'click', () => onLocationSelect?.(location.id))
    })
  }, [locations, mapLoaded, onLocationSelect])

  // Update player marker
  useEffect(() => {
    if (!mapInstanceRef.current || !playerPosition || !mapLoaded) return
    const { kakao } = window
    if (playerMarkerRef.current) playerMarkerRef.current.setMap(null)

    const playerPos = new kakao.maps.LatLng(playerPosition.lat, playerPosition.lng)
    const playerMarker = new kakao.maps.Marker({
      position: playerPos,
      image: createPlayerMarkerImage(),
      zIndex: 10,
    })
    playerMarker.setMap(mapInstanceRef.current)
    playerMarkerRef.current = playerMarker
    if (!userDragged) {
      mapInstanceRef.current.panTo(playerPos)
    }
  }, [playerPosition, mapLoaded])

  // Update team member markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    const { kakao } = window

    // 기존 팀원 마커 제거
    teamMemberMarkersRef.current.forEach((marker) => marker.setMap(null))
    teamMemberMarkersRef.current = []

    // 팀원 위치 마커 생성 (녹색 점)
    teamMemberPositions.forEach((pos) => {
      const markerPos = new kakao.maps.LatLng(pos.lat, pos.lng)
      const marker = new kakao.maps.Marker({
        position: markerPos,
        image: createTeamMemberMarkerImage(),
        zIndex: 5,
      })
      marker.setMap(mapInstanceRef.current)
      teamMemberMarkersRef.current.push(marker)
    })
  }, [teamMemberPositions, mapLoaded])

  // Relayout on resize
  useEffect(() => {
    if (!mapInstanceRef.current || !mapRef.current) return
    const observer = new ResizeObserver(() => mapInstanceRef.current?.relayout())
    observer.observe(mapRef.current)
    return () => observer.disconnect()
  }, [mapLoaded])

  function recenterToPlayer() {
    if (mapInstanceRef.current && playerPosition) {
      const { kakao } = window
      const playerPos = new kakao.maps.LatLng(playerPosition.lat, playerPosition.lng)
      mapInstanceRef.current.panTo(playerPos)
    }
  }

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#0a0f1e', minHeight: '250px' }}>
        <div className="text-center text-gray-500">
          <p className="text-sm font-medium mb-1">지도를 불러올 수 없습니다</p>
          <p className="text-xs text-gray-600">카카오맵 API 로딩 실패</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '250px' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', backgroundColor: '#1a1f2e', minHeight: '250px' }} />
      {userDragged && playerPosition && (
        <button
          onClick={recenterToPlayer}
          style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 10,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(212, 168, 83, 0.4)',
            color: '#d4a853', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
          title="내 위치로"
        >
          📍
        </button>
      )}
    </div>
  )
}

function createMarkerImage(_locationId: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 42
  const ctx = canvas.getContext('2d')!

  // 핀 모양 — 숫자 없이 깔끔한 원 + 꼬리
  ctx.fillStyle = '#d4a853'
  ctx.strokeStyle = '#faf7f2'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(16, 13, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 음표 아이콘 (♪)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 14px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('♪', 16, 13)

  // 핀 꼬리
  ctx.fillStyle = '#d4a853'
  ctx.beginPath()
  ctx.moveTo(16, 24)
  ctx.lineTo(21, 42)
  ctx.lineTo(11, 42)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const imageData = canvas.toDataURL()
  return new window.kakao.maps.MarkerImage(imageData, new window.kakao.maps.Size(32, 42), { offset: new window.kakao.maps.Point(16, 42) })
}

function createPlayerMarkerImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 30
  canvas.height = 30
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
  ctx.beginPath()
  ctx.arc(15, 15, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
  ctx.beginPath()
  ctx.arc(15, 15, 10, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.arc(15, 15, 6, 0, Math.PI * 2)
  ctx.fill()

  const imageData = canvas.toDataURL()
  return new window.kakao.maps.MarkerImage(imageData, new window.kakao.maps.Size(30, 30), { offset: new window.kakao.maps.Point(15, 15) })
}

function createTeamMemberMarkerImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 24
  canvas.height = 24
  const ctx = canvas.getContext('2d')!

  // 바깥 원 (연한 녹색)
  ctx.fillStyle = 'rgba(111, 234, 141, 0.2)'
  ctx.beginPath()
  ctx.arc(12, 12, 11, 0, Math.PI * 2)
  ctx.fill()

  // 중간 원
  ctx.fillStyle = 'rgba(111, 234, 141, 0.5)'
  ctx.beginPath()
  ctx.arc(12, 12, 7, 0, Math.PI * 2)
  ctx.fill()

  // 안쪽 원 (진한 녹색)
  ctx.fillStyle = '#6fea8d'
  ctx.beginPath()
  ctx.arc(12, 12, 4, 0, Math.PI * 2)
  ctx.fill()

  const imageData = canvas.toDataURL()
  return new window.kakao.maps.MarkerImage(imageData, new window.kakao.maps.Size(24, 24), { offset: new window.kakao.maps.Point(12, 12) })
}
