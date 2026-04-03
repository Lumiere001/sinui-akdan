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
  onLocationSelect?: (locationId: string) => void
}

export function MapView({
  locations,
  playerPosition,
  onLocationSelect,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const playerMarkerRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Load Kakao Maps API
  useEffect(() => {
    if (window.kakao) {
      setMapLoaded(true)
      return
    }

    const script = document.createElement('script')
    const apiKey = import.meta.env.VITE_KAKAO_MAP_KEY || 'YOUR_KAKAO_API_KEY'
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer`
    script.onload = () => {
      setMapLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load Kakao Maps API')
    }
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    const { kakao } = window
    const mapContainer = mapRef.current
    const mapOptions = {
      center: new kakao.maps.LatLng(
        playerPosition?.lat || 35.144,
        playerPosition?.lng || 126.915
      ),
      level: 4,
    }

    const map = new kakao.maps.Map(mapContainer, mapOptions)
    mapInstanceRef.current = map

    // Add info window styles
    const style = document.createElement('style')
    style.textContent = `
      .kakao_map_info {
        background-color: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(212, 168, 83, 0.5);
        border-radius: 8px;
        padding: 12px;
        color: #faf7f2;
      }
      .kakao_map_info p {
        margin: 0;
        font-size: 14px;
        color: #d1d5db;
      }
      .kakao_map_info strong {
        color: #d4a853;
      }
    `
    document.head.appendChild(style)
  }, [mapLoaded, playerPosition])

  // Update location markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return

    const { kakao } = window

    // Remove old markers
    markersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    markersRef.current.clear()

    // Add location markers
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

      // Add click event
      const infoWindow = new kakao.maps.InfoWindow({
        content: `<div class="kakao_map_info">
          <p><strong>${location.name}</strong></p>
          <p>ID: ${location.id}</p>
        </div>`,
        disableAutoPan: true,
      })

      kakao.maps.event.addListener(marker, 'click', () => {
        infoWindow.open(mapInstanceRef.current, marker)
        onLocationSelect?.(location.id)
      })
    })
  }, [locations, mapLoaded, onLocationSelect])

  // Update player position marker
  useEffect(() => {
    if (!mapInstanceRef.current || !playerPosition || !mapLoaded) return

    const { kakao } = window

    if (playerMarkerRef.current) {
      playerMarkerRef.current.setMap(null)
    }

    const playerPos = new kakao.maps.LatLng(playerPosition.lat, playerPosition.lng)

    // Create pulsing player marker using custom overlay
    const playerMarker = new kakao.maps.Marker({
      position: playerPos,
      image: createPlayerMarkerImage(),
      zIndex: 10,
    })

    playerMarker.setMap(mapInstanceRef.current)
    playerMarkerRef.current = playerMarker

    // Center map on player
    mapInstanceRef.current.setCenter(playerPos)
  }, [playerPosition, mapLoaded])

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg overflow-hidden border border-slate-700/40"
      style={{ backgroundColor: '#0f172a', minHeight: '300px' }}
    />
  )
}

function createMarkerImage(locationId: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 50
  const ctx = canvas.getContext('2d')!

  // Draw marker shape
  ctx.fillStyle = '#d4a853'
  ctx.strokeStyle = '#faf7f2'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(20, 15, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Draw location number
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(locationId, 20, 15)

  // Draw marker point
  ctx.fillStyle = '#d4a853'
  ctx.beginPath()
  ctx.moveTo(20, 28)
  ctx.lineTo(26, 50)
  ctx.lineTo(14, 50)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const imageData = canvas.toDataURL()
  return new window.kakao.maps.MarkerImage(
    imageData,
    new window.kakao.maps.Size(40, 50),
    { offset: new window.kakao.maps.Point(20, 50) }
  )
}

function createPlayerMarkerImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 30
  canvas.height = 30
  const ctx = canvas.getContext('2d')!

  // Draw outer pulse circle
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
  ctx.beginPath()
  ctx.arc(15, 15, 14, 0, Math.PI * 2)
  ctx.fill()

  // Draw middle circle
  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
  ctx.beginPath()
  ctx.arc(15, 15, 10, 0, Math.PI * 2)
  ctx.fill()

  // Draw inner circle (player position)
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath()
  ctx.arc(15, 15, 6, 0, Math.PI * 2)
  ctx.fill()

  const imageData = canvas.toDataURL()
  return new window.kakao.maps.MarkerImage(
    imageData,
    new window.kakao.maps.Size(30, 30),
    { offset: new window.kakao.maps.Point(15, 15) }
  )
}
