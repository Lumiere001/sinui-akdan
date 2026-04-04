import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useTimer } from '../hooks/useTimer'
import { MapView } from '../components/MapView'
import type { GameState, PlayerPosition } from '../../../shared/types'
import { LogOut, Play, Square, RotateCcw, Wifi, WifiOff, Users, Clock, Shield } from 'lucide-react'
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

  const handlePasswordSubmit = () => {
    if (password === 'admin1234') {
      setIsAuthenticated(true)
      setPassword('')
    } else {
      alert('잘못된 비밀번호입니다')
      setPassword('')
    }
  }

  useEffect(() => {
    if (!socket) return

    const handleGameState = (state: GameState) => setGameState(state)
    const handleAllPositions = (data: Record<number, PlayerPosition[]>) => setAllPositions(data)

    socket.on('game:state', handleGameState)
    socket.on('admin:allPositions', handleAllPositions)

    return () => {
      socket.off('game:state', handleGameState)
      socket.off('admin:allPositions', handleAllPositions)
    }
  }, [socket])

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

  const getTeamStatus = (teamId: number) => {
    const team = gameState?.teams[teamId]
    if (!team) return 'unknown'
    if (team.unlockedLocation) return 'found'
    const positions = allPositions[teamId] || []
    if (positions.length === 0) return 'not_found'
    return 'searching'
  }

  // ── Login screen ──
  if (!isAuthenticated) {
    return (
      <motion.div
        className="noise flex flex-col items-center justify-center min-h-screen w-full px-5"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.06) 0%, #0a0f1e 60%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-full max-w-xs"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-gold glow-gold mb-5">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1">관리자</h1>
            <p className="text-xs text-gray-500">비밀번호를 입력하세요</p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="비밀번호"
              className="w-full px-4 py-3.5 rounded-xl glass text-white text-sm placeholder-gray-500 focus:border-amber-400/30 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-all"
              autoFocus
            />

            <button
              onClick={handlePasswordSubmit}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-xl font-bold text-sm glow-gold hover:shadow-xl transition-all"
            >
              로그인
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ── Dashboard ──
  const playerPositions: Array<{ lat: number; lng: number; teamId: number }> = []
  Object.entries(allPositions).forEach(([teamId, positions]) => {
    positions.forEach((pos) => {
      playerPositions.push({ lat: pos.lat, lng: pos.lng, teamId: parseInt(teamId, 10) })
    })
  })

  const totalPlayers = Object.values(allPositions).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <motion.div
      className="noise flex flex-col h-screen w-full"
      style={{ background: '#0a0f1e' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="glass border-b border-white/[0.04] px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">관리자 대시보드</h1>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                {isConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
                {isConnected ? '연결됨' : '연결 해제'}
              </span>
              <span>·</span>
              <span>R{gameState?.currentRound || '-'}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {totalPlayers}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg glass text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-3 p-3">
        {/* Left column */}
        <div className="w-full lg:w-80 space-y-3 overflow-y-auto">
          {/* Round Control */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">라운드 제어</h2>

            <div className="space-y-2">
              <button
                onClick={() => handleStartRound(1)}
                disabled={gameState?.isActive}
                className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/15 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/25"
              >
                <Play className="w-3.5 h-3.5" />
                라운드 1 시작
              </button>
              <button
                onClick={() => handleStartRound(2)}
                disabled={gameState?.isActive}
                className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-blue-500/15 text-blue-400 border border-blue-400/20 hover:bg-blue-500/25"
              >
                <Play className="w-3.5 h-3.5" />
                라운드 2 시작
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStopRound}
                  disabled={!gameState?.isActive}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-red-500/15 text-red-400 border border-red-400/20 hover:bg-red-500/25"
                >
                  <Square className="w-3.5 h-3.5" />
                  중지
                </button>
                <button
                  onClick={handleResetGame}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all bg-amber-500/15 text-amber-400 border border-amber-400/20 hover:bg-amber-500/25"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  초기화
                </button>
              </div>
            </div>
          </div>

          {/* Timer Display */}
          {gameState?.isActive && (
            <motion.div
              className="glass-gold glow-gold rounded-2xl p-5 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400/60" />
                <span className="text-[10px] text-amber-400/60 font-semibold uppercase tracking-wider">남은 시간</span>
              </div>
              <p className="text-4xl font-extrabold text-gradient-gold tabular-nums">
                {timer.minutes.toString().padStart(2, '0')}:{timer.seconds.toString().padStart(2, '0')}
              </p>
            </motion.div>
          )}

          {/* Team Monitor */}
          <div className="glass rounded-2xl p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">팀 모니터</h2>

            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((tid) => {
                const team = gameState?.teams[tid]
                const positions = allPositions[tid] || []
                const status = getTeamStatus(tid)

                const statusConfig = {
                  found: { label: '찾음', dotColor: 'bg-emerald-400', borderColor: 'border-emerald-400/20' },
                  searching: { label: '탐색', dotColor: 'bg-blue-400', borderColor: 'border-blue-400/20' },
                  approaching: { label: '접근', dotColor: 'bg-amber-400', borderColor: 'border-amber-400/20' },
                  not_found: { label: '대기', dotColor: 'bg-gray-600', borderColor: 'border-white/[0.04]' },
                  unknown: { label: '?', dotColor: 'bg-gray-600', borderColor: 'border-white/[0.04]' },
                }

                const config = statusConfig[status as keyof typeof statusConfig]

                return (
                  <motion.button
                    key={tid}
                    onClick={() => setExpandedTeam(expandedTeam === tid ? null : tid)}
                    className={`p-3 rounded-xl border transition-all ${config.borderColor} ${
                      team?.unlockedLocation ? 'bg-emerald-500/[0.06]' : 'bg-white/[0.02] hover:bg-white/[0.04]'
                    } ${expandedTeam === tid ? 'ring-1 ring-amber-400/30' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">팀 {tid}</span>
                      <div className={`w-2 h-2 rounded-full ${config.dotColor} ${status === 'searching' ? 'pulse-dot' : ''}`} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-500">{positions.length}명</span>
                      <span className="text-[10px] text-gray-400 font-medium">{config.label}</span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Expanded Team Details */}
          <AnimatePresence>
            {expandedTeam && gameState?.teams[expandedTeam] && (
              <motion.div
                className="glass-gold rounded-2xl p-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="font-bold text-amber-300 text-xs mb-3">팀 {expandedTeam} 상세</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>멤버 수</span>
                    <span className="text-white font-semibold">{allPositions[expandedTeam]?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>상태</span>
                    <span className="text-white font-semibold">{getTeamStatus(expandedTeam)}</span>
                  </div>
                  {gameState.teams[expandedTeam]?.unlockedLocation && (
                    <div className="flex justify-between">
                      <span>찾은 장소</span>
                      <span className="text-emerald-400 font-semibold">{gameState.teams[expandedTeam].unlockedLocation}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Map */}
        <motion.div
          className="flex-1 rounded-2xl overflow-hidden border border-white/[0.04]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
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