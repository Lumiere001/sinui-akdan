import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useGPS } from '../hooks/useGPS'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import { Timer } from '../components/Timer'
import { HintCard } from '../components/HintCard'
import { LocationCard } from '../components/LocationCard'
import { LOCATIONS } from '../data/gameData'
import type { GameState, TeamConfig } from '../../../shared/types'
import { ChevronUp, MapPin, AlertCircle, Wifi, WifiOff, Map } from 'lucide-react'

export function Game() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const { position: gpsPosition, error: gpsError, isTracking } = useGPS()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [teamConfig, setTeamConfig] = useState<TeamConfig | null>(null)
  const [visibleLocations, setVisibleLocations] = useState(LOCATIONS)
  const [teamId, setTeamId] = useState<number | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isCheckingLocation, setIsCheckingLocation] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  const timer = useTimer(gameState?.startTime || null, gameState?.duration || 0)

  useEffect(() => {
    const storedTeamId = localStorage.getItem('teamId')
    const storedPlayerId = localStorage.getItem('playerId')
    if (storedTeamId && storedPlayerId) {
      setTeamId(parseInt(storedTeamId, 10))
      setPlayerId(storedPlayerId)
    } else {
      navigate('/')
    }
  }, [navigate])

  useEffect(() => {
    if (!socket || !teamId || !playerId || !isConnected) return
    socket.emit('player:join', { teamId, playerId })
  }, [socket, teamId, playerId, isConnected])

  useEffect(() => {
    if (!socket) return
    const handleGameState = (state: GameState) => {
      setGameState(state)
      if (state.currentRound && teamId) {
        const round = state[`round_${state.currentRound}` as keyof GameState] as any
        if (round && round.teams && round.teams[teamId]) {
          const config = round.teams[teamId] as TeamConfig
          setTeamConfig(config)
          const visibleIds = config.visibleLocations
          setVisibleLocations(LOCATIONS.filter((loc) => visibleIds.includes(loc.id)))
        }
      }
    }
    const handleTeamMemberCount = (data: { locationId: string; count: number; needed: number }) => {
      setMemberCounts((prev) => ({ ...prev, [data.locationId]: data.count }))
    }
    const handleTeamUnlock = (data: { teamId: number; locationId: string; photo: string }) => {
      if (data.teamId === teamId) {
        navigate(`/result/correct`, { state: { photoUrl: data.photo } })
      }
    }
    const handleTeamWrong = (data: { teamId: number; locationId: string }) => {
      if (data.teamId === teamId) {
        navigate('/result/wrong')
      }
    }
    socket.on('game:state', handleGameState)
    socket.on('team:memberCount', handleTeamMemberCount)
    socket.on('team:unlock', handleTeamUnlock)
    socket.on('team:wrong', handleTeamWrong)
    return () => {
      socket.off('game:state', handleGameState)
      socket.off('team:memberCount', handleTeamMemberCount)
      socket.off('team:unlock', handleTeamUnlock)
      socket.off('team:wrong', handleTeamWrong)
    }
  }, [socket, teamId, navigate])

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

  const handleCheckLocation = useCallback(
    (locationId: string) => {
      if (!socket || isCheckingLocation) return
      setIsCheckingLocation(true)
      socket.emit('player:checkLocation', { locationId })
      setTimeout(() => setIsCheckingLocation(false), 1000)
    },
    [socket, isCheckingLocation]
  )

  const gameActive = gameState?.isActive
  const timerExpired = timer.isExpired
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
      <div className="glass border-b border-white/[0.04] px-4 py-3 flex items-center justify-between gap-3 z-20">
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-gold"
          animate={{ borderColor: ['rgba(212,168,83,0.15)', 'rgba(212,168,83,0.3)', 'rgba(212,168,83,0.15)'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 pulse-dot" />
          <span className="text-amber-300 font-bold text-xs">팀 {teamId}</span>
        </motion.div>
        <Timer startTime={gameState?.startTime || null} duration={gameState?.duration || 1800000} />
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-emerald-400/70" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400/70" />
          )}
        </div>
      </div>

      {/* Status alerts */}
      <AnimatePresence>
        {!gameActive && (
          <motion.div
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/[0.06] border-b border-amber-400/10"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AlertCircle className="w-4 h-4 text-amber-400/80 shrink-0" />
            <span className="text-amber-300/80 text-xs font-medium">게임이 시작되기를 기다리는 중입니다</span>
          </motion.div>
        )}
        {gpsError && (
          <motion.div
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/[0.06] border-b border-red-400/10"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0" />
            <span className="text-red-300/80 text-xs">{gpsError}</span>
          </motion.div>
        )}
        {!isTracking && !gpsError && (
          <motion.div
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/[0.06] border-b border-amber-400/10"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <motion.div
              className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full shrink-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="text-amber-300/80 text-xs font-medium">위치 추적 중...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main game area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence>
          {showMap && (
            <motion.div
              className="relative flex-[55%] overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              layout
            >
              {gpsPosition ? (
                <MapView
                  locations={visibleLocations}
                  playerPosition={{ lat: gpsPosition.lat, lng: gpsPosition.lng }}
                  onLocationSelect={handleCheckLocation}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0f1e', minHeight: '200px' }}>
                  <div className="text-center text-gray-500">
                    <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs font-medium">위치 정보를 기다리는 중...</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowMap(false)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 glass hover:bg-white/[0.06] px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all z-10"
              >
                <ChevronUp className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] text-gray-400 font-medium">지도 접기</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={`relative bg-[#0a0f1e] border-t border-white/[0.04] overflow-hidden flex flex-col ${showMap ? 'flex-[45%]' : 'flex-1'}`}
          layout
        >
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <h2 className="text-sm font-bold text-white">찾을 장소들</h2>
              <span className="text-[11px] text-gray-600 font-medium">{visibleLocations.length}곳</span>
            </div>
            {!showMap && (
              <button
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-[11px] text-gray-400 font-medium hover:text-white transition-colors"
              >
                <Map className="w-3.5 h-3.5" />
                지도 보기
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {teamConfig && <HintCard hint={teamConfig.hint} />}
            {visibleLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                playerLat={gpsPosition?.lat || null}
                playerLng={gpsPosition?.lng || null}
                memberCount={memberCounts[location.id] || 0}
                membersNeeded={3}
                isCheckingIn={isCheckingLocation}
                onCheck={() => handleCheckLocation(location.id)}
              />
            ))}
            {visibleLocations.length === 0 && (
              <div className="text-center text-gray-600 py-12">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">표시할 장소가 없습니다</p>
              </div>
            )}
            <div className="h-4" />
          </div>
        </motion.div>
      </div>

      {/* Game over overlay */}
      <AnimatePresence>
        {timerExpired && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass glow-gold rounded-3xl p-10 text-center max-w-sm w-full"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="text-5xl mb-4">🎵</div>
              <h2 className="text-3xl font-extrabold text-gradient-gold mb-3">게임 종료</h2>
              <p className="text-gray-400 text-sm mb-8">시간이 종료되었습니다</p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-xl font-bold text-sm glow-gold hover:shadow-xl transition-all"
              >
                돌아가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}