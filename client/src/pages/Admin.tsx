import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import type { GameState, PlayerPosition } from '../../../shared/types'
import { Lock, LogOut, Play, Square, RotateCcw } from 'lucide-react'
import { LOCATIONS } from '../data/gameData'

export function Admin() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [allPositions, setAllPositions] = useState<Record<number, PlayerPosition[]>>({})
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)

  const timer = useTimer(gameState?.startTime || null, gameState?.duration || 0)

  // Password check
  const handlePasswordSubmit = () => {
    if (password === 'admin1234') {
      setIsAuthenticated(true)
      setPassword('')
    } else {
      alert('잘못된 비밀번호입니다')
      setPassword('')
    }
  }

  // Listen for game state
  useEffect(() => {
    if (!socket) return

    const handleGameState = (state: GameState) => {
      setGameState(state)
    }

    const handleAllPositions = (data: Record<number, PlayerPosition[]>) => {
      setAllPositions(data)
    }

    socket.on('game:state', handleGameState)
    socket.on('admin:allPositions', handleAllPositions)

    return () => {
      socket.off('game:state', handleGameState)
      socket.off('admin:allPositions', handleAllPositions)
    }
  }, [socket])

  // Handle admin commands
  const handleStartRound = (roundId: number) => {
    if (!socket) return
    socket.emit('admin:startRound', roundId)
  }

  const handleStopRound = () => {
    if (!socket) return
    socket.emit('admin:stopRound')
  }

  const handleResetGame = () => {
    if (!socket) return
    if (confirm('게임을 초기화하시겠습니까?')) {
      socket.emit('admin:resetGame')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    navigate('/')
  }

  // Get team status
  const getTeamStatus = (teamId: number) => {
    const team = gameState?.teams[teamId]
    if (!team) return 'unknown'

    if (team.unlockedLocation) return 'found'
    const positions = allPositions[teamId] || []
    if (positions.length === 0) return 'not_found'
    return 'searching'
  }


  if (!isAuthenticated) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center min-h-screen w-full px-6 bg-gradient-to-b from-slate-900 to-slate-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-full max-w-sm space-y-6 bg-slate-800/50 border border-slate-700/40 rounded-lg p-8"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
        >
          <div className="flex justify-center mb-6">
            <Lock className="w-12 h-12 text-gold" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">관리자 대시보드</h1>
            <p className="text-gray-400">비밀번호를 입력하세요</p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="비밀번호"
            className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white placeholder-gray-400 border border-slate-600 focus:border-gold focus:outline-none"
            autoFocus
          />

          <button
            onClick={handlePasswordSubmit}
            className="w-full py-3 bg-gradient-to-r from-gold to-amber-500 text-slate-900 rounded-lg font-bold hover:shadow-lg hover:shadow-gold/50 transition-all"
          >
            로그인
          </button>
        </motion.div>
      </motion.div>
    )
  }

  // Get all team positions for map display
  const playerPositions: Array<{ lat: number; lng: number; teamId: number }> = []
  Object.entries(allPositions).forEach(([teamId, positions]) => {
    positions.forEach((pos) => {
      playerPositions.push({
        lat: pos.lat,
        lng: pos.lng,
        teamId: parseInt(teamId, 10),
      })
    })
  })

  return (
    <motion.div
      className="flex flex-col h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700/40 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold">관리자 대시보드</h1>
          <p className="text-xs text-gray-400">
            상태: {isConnected ? '연결됨' : '연결 해제'} | 라운드: {gameState?.currentRound || '-'} |{' '}
            {gameState?.isActive ? '활성' : '비활성'}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 p-4">
        {/* Left column: Controls and Teams */}
        <div className="w-full lg:w-96 space-y-4 overflow-y-auto">
          {/* Round Control */}
          <motion.div
            className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-bold text-white">라운드 제어</h2>

            <div className="space-y-2">
              <button
                onClick={() => handleStartRound(1)}
                disabled={gameState?.isActive}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                라운드 1 시작
              </button>
              <button
                onClick={() => handleStartRound(2)}
                disabled={gameState?.isActive}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                라운드 2 시작
              </button>
              <button
                onClick={handleStopRound}
                disabled={!gameState?.isActive}
                className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4" />
                중지
              </button>
              <button
                onClick={handleResetGame}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                초기화
              </button>
            </div>
          </motion.div>

          {/* Timer Display */}
          {gameState?.isActive && (
            <motion.div
              className="bg-slate-800/50 border border-gold/40 rounded-lg p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-gray-400 text-sm mb-2">남은 시간</p>
              <p className="text-4xl font-bold text-gold">
                {timer.minutes.toString().padStart(2, '0')}:{timer.seconds.toString().padStart(2, '0')}
              </p>
            </motion.div>
          )}

          {/* Team Monitor */}
          <motion.div
            className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-bold text-white mb-4">팀 모니터</h2>

            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((teamId) => {
                const team = gameState?.teams[teamId]
                const positions = allPositions[teamId] || []
                const status = getTeamStatus(teamId)

                const statusConfig = {
                  found: { label: '찾음', color: 'bg-emerald-600' },
                  searching: { label: '탐색중', color: 'bg-blue-600' },
                  approaching: { label: '접근', color: 'bg-amber-600' },
                  not_found: { label: '미참가', color: 'bg-gray-600' },
                  unknown: { label: '?', color: 'bg-gray-600' },
                }

                const config = statusConfig[status as keyof typeof statusConfig]

                return (
                  <motion.button
                    key={teamId}
                    onClick={() => setExpandedTeam(expandedTeam === teamId ? null : teamId)}
                    className={`p-3 rounded-lg border transition-all ${
                      team?.unlockedLocation
                        ? 'bg-emerald-900/40 border-emerald-600/40'
                        : 'bg-slate-700/40 border-slate-600/40 hover:border-slate-500/60'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-left">
                      <p className="font-bold text-white">팀 {teamId}</p>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-gray-300">{positions.length}명</span>
                        <span className={`px-2 py-1 rounded-full text-white font-medium ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>

          {/* Expanded Team Details */}
          <AnimatePresence>
            {expandedTeam && gameState?.teams[expandedTeam] && (
              <motion.div
                className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="font-bold text-gold mb-3">팀 {expandedTeam} 상세</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    멤버 수: <span className="text-white font-semibold">{allPositions[expandedTeam]?.length || 0}</span>
                  </p>
                  <p>
                    상태:{' '}
                    <span className="text-white font-semibold">{getTeamStatus(expandedTeam)}</span>
                  </p>
                  {gameState.teams[expandedTeam]?.unlockedLocation && (
                    <p>
                      찾은 장소:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {gameState.teams[expandedTeam].unlockedLocation}
                      </span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Map */}
        <motion.div
          className="flex-1 rounded-lg overflow-hidden border border-slate-700/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <MapView
            locations={LOCATIONS}
            playerPosition={
              playerPositions.length > 0
                ? { lat: playerPositions[0].lat, lng: playerPositions[0].lng }
                : null
            }
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
