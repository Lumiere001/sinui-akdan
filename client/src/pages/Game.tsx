import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useGPS } from '../hooks/useGPS'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import { HintCard } from '../components/HintCard'
import { getTeamLocations, calculateDistance } from '../data/gameData'
import type { Location, GameState } from '../../../shared/types'

function formatDistance(meters: number) {
  if (meters === Infinity) return '--'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function getBearingArrow(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLon = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  return arrows[Math.round(bearing / 45) % 8]
}

export function Game() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { position: gpsPosition, error: gpsError } = useGPS()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [teamId, setTeamId] = useState<number | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isCheckingLocation, setIsCheckingLocation] = useState(false)
  const [foundLocations, setFoundLocations] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)

  const timer = useTimer(gameState?.startTime || null, gameState?.duration || 0)

  const teamLocations = useMemo(() => {
    if (!teamId) return []
    return getTeamLocations(teamId)
  }, [teamId])

  const currentLocation: Location | null = teamLocations[currentIndex] || null

  useEffect(() => {
    const storedTeamId = localStorage.getItem('teamId')
    const storedPlayerId = localStorage.getItem('playerId')
    if (storedTeamId && storedPlayerId) {
      setTeamId(parseInt(storedTeamId, 10))
      setPlayerId(storedPlayerId)
    } else {
      navigate('/')
    }
    const savedFound = localStorage.getItem('foundLocations')
    if (savedFound) {
      try { setFoundLocations(new Set(JSON.parse(savedFound) as string[])) } catch { /* ignore */ }
    }
    const savedIndex = localStorage.getItem('currentLocationIndex')
    if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10) || 0)
  }, [navigate])

  useEffect(() => {
    localStorage.setItem('foundLocations', JSON.stringify([...foundLocations]))
    localStorage.setItem('currentLocationIndex', currentIndex.toString())
  }, [foundLocations, currentIndex])

  useEffect(() => {
    if (!socket || !teamId || !playerId || !isConnected) return
    socket.emit('player:join', { teamId, playerId })
  }, [socket, teamId, playerId, isConnected])

  useEffect(() => {
    if (!socket) return
    const handleGameState = (state: GameState) => setGameState(state)
    socket.on('game:state', handleGameState)
    return () => { socket.off('game:state', handleGameState) }
  }, [socket])

  useEffect(() => {
    if (!socket || !gpsPosition || !teamId || !playerId) return
    const interval = setInterval(() => {
      socket.emit('player:position', {
        playerId, teamId,
        lat: gpsPosition.lat, lng: gpsPosition.lng,
        timestamp: Date.now(),
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [socket, gpsPosition, teamId, playerId])

  const distanceToCurrent = useMemo(() => {
    if (!gpsPosition || !currentLocation) return Infinity
    return calculateDistance(gpsPosition.lat, gpsPosition.lng, currentLocation.lat, currentLocation.lng)
  }, [gpsPosition, currentLocation])

  const status = useMemo(() => {
    if (!currentLocation) return 'far' as const
    if (distanceToCurrent <= currentLocation.unlockRadius) return 'arrived' as const
    if (distanceToCurrent <= currentLocation.approachRadius) return 'approaching' as const
    return 'far' as const
  }, [distanceToCurrent, currentLocation])

  const isCurrentFound = currentLocation ? foundLocations.has(currentLocation.id) : false

  const handleCheckIn = useCallback(() => {
    if (!currentLocation || isCheckingLocation || status !== 'arrived' || isCurrentFound) return
    setIsCheckingLocation(true)
    if (socket) socket.emit('player:checkLocation', { locationId: currentLocation.id })
    setFoundLocations((prev) => { const next = new Set(prev); next.add(currentLocation.id); return next })
    setTimeout(() => {
      setIsCheckingLocation(false)
      const nextUnfound = teamLocations.findIndex((loc, idx) => idx > currentIndex && !foundLocations.has(loc.id))
      if (nextUnfound !== -1) setCurrentIndex(nextUnfound)
    }, 1500)
  }, [currentLocation, isCheckingLocation, status, isCurrentFound, socket, teamLocations, currentIndex, foundLocations])

  const timerExpired = timer.isExpired
  const allFound = teamLocations.length > 0 && teamLocations.every((loc) => foundLocations.has(loc.id))

  if (!teamId) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)',
        zIndex: 100, position: 'sticky', top: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>
              팀 {teamId}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
              {foundLocations.size}/{teamLocations.length} 해금됨
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Timer */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                {timer.minutes.toString().padStart(2, '0')}:{timer.seconds.toString().padStart(2, '0')}
              </div>
            </div>

            {/* GPS Status */}
            {gpsError ? (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff6b6b' }} />
            ) : isConnected ? (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6fea8d', animation: 'pulse-dot 2s infinite' }} />
            ) : (
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: '10px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(foundLocations.size / teamLocations.length) * 100}%`,
            background: 'linear-gradient(90deg, #6fea8d, #4ecdc4)',
            borderRadius: '2px', transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* GPS Error */}
      {gpsError && (
        <div style={{ padding: '10px 20px', background: 'rgba(255,100,100,0.06)', borderBottom: '1px solid rgba(255,100,100,0.1)' }}>
          <span style={{ fontSize: '12px', color: '#ff6b6b' }}>{gpsError}</span>
        </div>
      )}

      {/* Map — 55% */}
      <div style={{ flex: '0 0 50%', position: 'relative' }}>
        {gpsPosition ? (
          <MapView
            locations={teamLocations}
            playerPosition={{ lat: gpsPosition.lat, lng: gpsPosition.lng }}
            onLocationSelect={(id) => { const idx = teamLocations.findIndex((l) => l.id === id); if (idx !== -1) setCurrentIndex(idx) }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📍</div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>위치 정보를 기다리는 중...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel — 50% */}
      <div style={{
        flex: 1, borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {allFound ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div style={{ textAlign: 'center' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎵</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#6fea8d', marginBottom: '6px' }}>모든 단서를 수집했습니다</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                악보를 완성하고<br />센터로 복귀하세요
              </div>
            </motion.div>
          </div>
        ) : currentLocation ? (
          <>
            {/* Location nav */}
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                style={{
                  background: 'none', border: 'none', color: currentIndex === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                  fontSize: '20px', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', padding: '4px 8px',
                }}
              >
                ‹
              </button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: isCurrentFound ? 'rgba(100,255,150,0.15)' : 'rgba(255,255,255,0.08)',
                    fontSize: '11px', fontWeight: '700', fontFamily: 'monospace',
                    color: isCurrentFound ? '#6fea8d' : 'rgba(255,255,255,0.5)',
                  }}>
                    {currentLocation.id}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                    {currentLocation.name}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  {currentIndex + 1} / {teamLocations.length}
                </div>
              </div>

              <button
                onClick={() => setCurrentIndex(Math.min(teamLocations.length - 1, currentIndex + 1))}
                disabled={currentIndex === teamLocations.length - 1}
                style={{
                  background: 'none', border: 'none',
                  color: currentIndex === teamLocations.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                  fontSize: '20px', cursor: currentIndex === teamLocations.length - 1 ? 'not-allowed' : 'pointer', padding: '4px 8px',
                }}
              >
                ›
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Distance & status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '6px',
                    background: isCurrentFound ? 'rgba(100,255,150,0.1)' : status === 'arrived' ? 'rgba(100,255,150,0.1)' : status === 'approaching' ? 'rgba(255,200,50,0.1)' : 'rgba(255,255,255,0.04)',
                    color: isCurrentFound ? '#6fea8d' : status === 'arrived' ? '#6fea8d' : status === 'approaching' ? '#ffc832' : 'rgba(255,255,255,0.35)',
                    border: `1px solid ${isCurrentFound ? 'rgba(100,255,150,0.2)' : status === 'arrived' ? 'rgba(100,255,150,0.2)' : status === 'approaching' ? 'rgba(255,200,50,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    {isCurrentFound ? '해금됨 ✓' : status === 'arrived' ? '도착!' : status === 'approaching' ? '접근 중' : '탐색 중'}
                  </span>
                </div>

                {!isCurrentFound && gpsPosition && currentLocation && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '20px', fontWeight: '700', fontFamily: 'monospace',
                      color: status === 'arrived' ? '#6fea8d' : status === 'approaching' ? '#ffc832' : 'rgba(255,255,255,0.4)',
                    }}>
                      {formatDistance(distanceToCurrent)}
                    </span>
                    <span style={{
                      fontSize: '18px',
                      color: status === 'arrived' ? '#6fea8d' : status === 'approaching' ? '#ffc832' : 'rgba(255,255,255,0.3)',
                    }}>
                      {getBearingArrow(gpsPosition.lat, gpsPosition.lng, currentLocation.lat, currentLocation.lng)}
                    </span>
                  </div>
                )}
              </div>

              {/* Approaching warning */}
              {status === 'approaching' && !isCurrentFound && (
                <div style={{ fontSize: '12px', color: '#ffc832', fontWeight: '600' }}>
                  ⚡ 가까워지고 있습니다...
                </div>
              )}

              {/* Hint */}
              <HintCard hint={currentLocation.hint} />

              {/* Check-in button */}
              {!isCurrentFound && (
                <button
                  onClick={handleCheckIn}
                  disabled={status !== 'arrived' || isCheckingLocation}
                  style={{
                    width: '100%', padding: '16px',
                    background: status === 'arrived' ? 'rgba(100,255,150,0.15)' : 'rgba(255,255,255,0.03)',
                    color: status === 'arrived' ? '#6fea8d' : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${status === 'arrived' ? 'rgba(100,255,150,0.25)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: '12px', fontSize: '15px', fontWeight: '700',
                    cursor: status === 'arrived' ? 'pointer' : 'not-allowed',
                    fontFamily: "'Noto Serif KR', serif",
                    transition: 'all 0.2s',
                  }}
                >
                  {isCheckingLocation ? '확인 중...' : status === 'arrived' ? '이 장소 해금하기' : '장소에 도착하면 해금'}
                </button>
              )}

              {isCurrentFound && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'rgba(100,255,150,0.06)',
                    border: '1px solid rgba(100,255,150,0.15)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#6fea8d', fontWeight: '600' }}>해금됨 ✓</span>
                </motion.div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Game over */}
      <AnimatePresence>
        {timerExpired && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 200, padding: '24px',
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '40px', textAlign: 'center', maxWidth: '320px', width: '100%',
              }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            >
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎵</div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: '8px' }}>게임 종료</h2>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
                {foundLocations.size}/{teamLocations.length}개 단서를 수집했습니다
              </p>
              <button
                onClick={() => { localStorage.removeItem('foundLocations'); localStorage.removeItem('currentLocationIndex'); navigate('/') }}
                style={{
                  width: '100%', padding: '14px', background: 'rgba(255,255,255,0.9)',
                  color: '#0a0a0f', border: 'none', borderRadius: '12px',
                  fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: "'Noto Serif KR', serif",
                }}
              >
                돌아가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
