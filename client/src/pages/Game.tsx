import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useGPS } from '../hooks/useGPS'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import { Timer } from '../components/Timer'
import { HintCard } from '../components/HintCard'
import { getTeamLocations, calculateDistance } from '../data/gameData'
import type { Location, GameState } from '../../../shared/types'
import {
  MapPin, AlertCircle, Wifi, WifiOff, Map, CheckCircle, Navigation,
  ChevronRight, ChevronLeft, Sparkles
} from 'lucide-react'

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

  const formatDistance = (d: number) => {
    if (d === Infinity) return '--'
    if (d >= 1000) return `${(d / 1000).toFixed(1)}km`
    return `${Math.round(d)}m`
  }

  const gameActive = gameState?.isActive
  const timerExpired = timer.isExpired
  const allFound = teamLocations.length > 0 && teamLocations.every((loc) => foundLocations.has(loc.id))

  if (!teamId) return null

  return (
    <motion.div
      className="noise flex flex-col h-screen w-full overflow-hidden"
      style={{ background: '#0a0f1e' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top bar */}
      <div className="glass border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between gap-2 z-20">
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-gold"
          animate={{ borderColor: ['rgba(212,168,83,0.15)', 'rgba(212,168,83,0.3)', 'rgba(212,168,83,0.15)'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 pulse-dot" />
          <span className="text-amber-300 font-bold text-xs">팀 {teamId}</span>
        </motion.div>

        <div className="flex items-center gap-1.5">
          {teamLocations.map((loc, idx) => (
            <div key={loc.id} className={`w-2.5 h-2.5 rounded-full transition-all ${
              foundLocations.has(loc.id) ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                : idx === currentIndex ? 'bg-amber-400 pulse-dot' : 'bg-gray-700'
            }`} />
          ))}
          <span className="text-[10px] text-gray-500 font-semibold ml-1">{foundLocations.size}/{teamLocations.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <Timer startTime={gameState?.startTime || null} duration={gameState?.duration || 1800000} />
          {isConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400/70" /> : <WifiOff className="w-3.5 h-3.5 text-red-400/70" />}
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {!gameActive && !allFound && (
          <motion.div className="flex items-center gap-2 px-4 py-2 bg-amber-500/[0.06] border-b border-amber-400/10"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            <span className="text-amber-300/80 text-xs">게임 시작을 기다리는 중...</span>
          </motion.div>
        )}
        {gpsError && (
          <motion.div className="flex items-center gap-2 px-4 py-2 bg-red-500/[0.06] border-b border-red-400/10"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <AlertCircle className="w-3.5 h-3.5 text-red-400/80 shrink-0" />
            <span className="text-red-300/80 text-xs">{gpsError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map 60% + Card 40% */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative" style={{ flex: '0 0 55%' }}>
          {gpsPosition ? (
            <MapView
              locations={teamLocations}
              playerPosition={{ lat: gpsPosition.lat, lng: gpsPosition.lng }}
              onLocationSelect={(id) => { const idx = teamLocations.findIndex((l) => l.id === id); if (idx !== -1) setCurrentIndex(idx) }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0f1e' }}>
              <div className="text-center text-gray-500">
                <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs font-medium">위치 정보를 기다리는 중...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 bg-[#0a0f1e] border-t border-white/[0.06] flex flex-col overflow-hidden">
          {allFound ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <motion.div className="text-center" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-extrabold text-gradient-gold mb-2">미션 완료!</h2>
                <p className="text-gray-400 text-sm">모든 장소를 찾았습니다</p>
              </motion.div>
            </div>
          ) : currentLocation ? (
            <>
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
                <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}
                  className="p-2 rounded-lg glass text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{currentIndex + 1} / {teamLocations.length}번째 장소</p>
                  <h3 className="text-base font-bold text-white mt-0.5">{currentLocation.name}</h3>
                </div>
                <button onClick={() => setCurrentIndex(Math.min(teamLocations.length - 1, currentIndex + 1))} disabled={currentIndex === teamLocations.length - 1}
                  className="p-2 rounded-lg glass text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    isCurrentFound ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/20'
                    : status === 'arrived' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/20'
                    : status === 'approaching' ? 'bg-amber-500/15 text-amber-400 border border-amber-400/20'
                    : 'bg-white/[0.04] text-gray-400 border border-white/[0.06]'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isCurrentFound ? 'bg-emerald-400' : status === 'arrived' ? 'bg-emerald-400 pulse-dot'
                      : status === 'approaching' ? 'bg-amber-400 pulse-dot' : 'bg-gray-500'
                    }`} />
                    {isCurrentFound ? '발견 완료' : status === 'arrived' ? '도착!' : status === 'approaching' ? '접근 중' : '이동 중'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Navigation className="w-3.5 h-3.5 text-blue-400/70" />
                    <span className="tabular-nums font-medium">{formatDistance(distanceToCurrent)}</span>
                  </div>
                </div>

                <HintCard hint={currentLocation.hint} />

                {!isCurrentFound && (
                  <motion.button onClick={handleCheckIn} disabled={status !== 'arrived' || isCheckingLocation}
                    className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      status === 'arrived'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20 cursor-pointer glow-emerald'
                        : 'glass text-gray-600 cursor-not-allowed'
                    }`}
                    whileHover={status === 'arrived' ? { scale: 1.02 } : {}}
                    whileTap={status === 'arrived' ? { scale: 0.98 } : {}}
                  >
                    {isCheckingLocation ? (
                      <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                    ) : <CheckCircle className="w-5 h-5" />}
                    {isCheckingLocation ? '확인 중...' : status === 'arrived' ? '이 장소 체크인!' : '장소에 도착하면 체크인'}
                  </motion.button>
                )}
                {isCurrentFound && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="w-full py-4 rounded-xl glass-gold glow-gold text-center">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold text-sm">이 장소를 발견했습니다!</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">장소 정보를 불러오는 중...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game over */}
      <AnimatePresence>
        {timerExpired && (
          <motion.div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass glow-gold rounded-3xl p-10 text-center max-w-sm w-full"
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <div className="text-5xl mb-4">🎵</div>
              <h2 className="text-3xl font-extrabold text-gradient-gold mb-3">게임 종료</h2>
              <p className="text-gray-400 text-sm mb-3">{foundLocations.size}/{teamLocations.length}개 장소를 찾았습니다</p>
              <button onClick={() => { localStorage.removeItem('foundLocations'); localStorage.removeItem('currentLocationIndex'); navigate('/') }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-xl font-bold text-sm glow-gold hover:shadow-xl transition-all">
                돌아가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
