import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useGPS } from '../hooks/useGPS'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import { Timer } from '../components/Timer'
import { HintCard } from '../components/HintCard'
import { LocationCard } from '../components/LocationCard'
import { LOCATIONS } from '../data/gameData'
import type { GameState, TeamConfig } from '../../../shared/types'
import { ChevronUp, MapPin, AlertCircle } from 'lucide-react'

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

  // Initialize IDs from localStorage
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

  // Join game when socket and IDs are ready
  useEffect(() => {
    if (!socket || !teamId || !playerId || !isConnected) return

    socket.emit('player:join', { teamId, playerId })
  }, [socket, teamId, playerId, isConnected])

  // Listen for game state updates
  useEffect(() => {
    if (!socket) return

    const handleGameState = (state: GameState) => {
      setGameState(state)

      // Update visible locations based on team config
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
      setMemberCounts((prev) => ({
        ...prev,
        [data.locationId]: data.count,
      }))
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

  // Send position updates
  useEffect(() => {
    if (!socket || !gpsPosition || !teamId || !playerId) return

    const interval = setInterval(() => {
      socket.emit('player:position', {
        playerId,
        teamId,
        lat: gpsPosition.lat,
        lng: gpsPosition.lng,
        timestamp: Date.now(),
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [socket, gpsPosition, teamId, playerId])

  // Handle location check
  const handleCheckLocation = useCallback(
    (locationId: string) => {
      if (!socket || isCheckingLocation) return

      setIsCheckingLocation(true)
      socket.emit('player:checkLocation', { locationId })

      setTimeout(() => {
        setIsCheckingLocation(false)
      }, 1000)
    },
    [socket, isCheckingLocation]
  )

  // Check if game is active
  const gameActive = gameState?.isActive
  const timerExpired = timer.isExpired

  if (!teamId) {
    return null
  }

  return (
    <motion.div
      className="flex flex-col h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Top bar with timer and team info */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700/40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="px-3 py-1 rounded-full bg-gold/20 border border-gold/40"
            animate={{ borderColor: ['rgba(212,168,83,0.4)', 'rgba(212,168,83,0.8)', 'rgba(212,168,83,0.4)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-gold font-semibold text-sm">팀 {teamId}</span>
          </motion.div>
        </div>

        <Timer startTime={gameState?.startTime || null} duration={gameState?.duration || 1800000} />

        <div className="text-right text-xs text-gray-400">
          {isConnected ? (
            <span className="text-emerald-400">연결됨</span>
          ) : (
            <span className="text-red-400">연결 해제</span>
          )}
        </div>
      </div>

      {/* Status alerts */}
      {!gameActive && (
        <motion.div
          className="bg-amber-900/30 border-b border-amber-700/40 px-4 py-3 flex items-center gap-2"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 text-sm">게임이 시작되기를 기다리는 중입니다</span>
        </motion.div>
      )}

      {gpsError && (
        <motion.div className="bg-red-900/30 border-b border-red-700/40 px-4 py-3">
          <p className="text-red-300 text-sm">{gpsError}</p>
        </motion.div>
      )}

      {!isTracking && !gpsError && (
        <motion.div className="bg-amber-900/30 border-b border-amber-700/40 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 text-sm">위치 추적 중...</span>
        </motion.div>
      )}

      {/* Main game area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map area - 55% */}
        {showMap && (
          <motion.div
            className="relative flex-[55%] overflow-hidden"
            layout
          >
            {gpsPosition ? (
              <MapView
                locations={visibleLocations}
                playerPosition={{ lat: gpsPosition.lat, lng: gpsPosition.lng }}
                onLocationSelect={handleCheckLocation}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <div className="text-center text-gray-400">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>위치 정보를 기다리는 중...</p>
                </div>
              </div>
            )}

            {/* Collapse/expand button */}
            <button
              onClick={() => setShowMap(!showMap)}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/80 backdrop-blur hover:bg-slate-800 p-2 rounded-full border border-slate-700/40 transition-all"
            >
              <ChevronUp className={`w-5 h-5 text-gold transition-transform ${showMap ? 'rotate-180' : ''}`} />
            </button>
          </motion.div>
        )}

        {/* Bottom panel - 45% */}
        <motion.div
          className="relative flex-[45%] bg-slate-900/50 border-t border-slate-700/40 overflow-hidden flex flex-col"
          layout
        >
          {/* Panel header */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gold" />
              찾을 장소들
            </h2>
            <button
              onClick={() => setShowMap(!showMap)}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
            >
              <ChevronUp className={`w-5 h-5 text-gold transition-transform ${!showMap ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {teamConfig && (
              <HintCard hint={teamConfig.hint} />
            )}

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
              <div className="text-center text-gray-400 py-8">
                <p>표시할 장소가 없습니다</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Game over overlay */}
      {timerExpired && (
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-slate-900 rounded-lg p-8 text-center border border-gold/40"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
          >
            <h2 className="text-3xl font-bold text-gold mb-4">게임 끝</h2>
            <p className="text-gray-300 mb-6">시간이 종료되었습니다</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-gold text-slate-900 rounded-lg font-semibold hover:bg-amber-500 transition-colors"
            >
              돌아가기
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
