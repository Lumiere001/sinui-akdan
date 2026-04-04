import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useTimer } from '../hooks/useTimer'
import type { GameState, PlayerPosition } from '../../../shared/types'
import { LogOut, Play, Square, RotateCcw, Wifi, WifiOff, Users, Clock, Shield, MapPin, CheckCircle } from 'lucide-react'
import { TEAMS, getTeamLocations } from '../data/gameData'

export function Admin() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [allPositions, setAllPositions] = useState<Record<number, PlayerPosition[]>>({})

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
    return () => { socket.off('game:state', handleGameState); socket.off('admin:allPositions', handleAllPositions) }
  }, [socket])

  const handleStartRound = (roundId: number) => { if (socket) socket.emit('admin:startRound', roundId) }
  const handleStopRound = () => { if (socket) socket.emit('admin:stopRound') }
  const handleResetGame = () => { if (socket && confirm('게임을 초기화하시겠습니까?')) socket.emit('admin:resetGame') }

  if (!isAuthenticated) {
    return (
      <motion.div className="noise flex flex-col items-center justify-center min-h-screen w-full px-5"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.06) 0%, #0a0f1e 60%)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className="w-full max-w-xs" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-gold glow-gold mb-5">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-1">관리자</h1>
            <p className="text-xs text-gray-500">비밀번호를 입력하세요</p>
          </div>
          <div className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} placeholder="비밀번호"
              className="w-full px-4 py-3.5 rounded-xl glass text-white text-sm placeholder-gray-500 focus:border-amber-400/30 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-all" autoFocus />
            <button onClick={handlePasswordSubmit}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-xl font-bold text-sm glow-gold hover:shadow-xl transition-all">
              로그인
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const totalPlayers = Object.values(allPositions).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <motion.div className="noise flex flex-col h-screen w-full" style={{ background: '#0a0f1e' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {totalPlayers}명</span>
            </div>
          </div>
        </div>
        <button onClick={() => { setIsAuthenticated(false); navigate('/') }}
          className="p-2 rounded-lg glass text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Controls */}
        <div className="flex gap-3">
          <div className="flex-1 glass rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">게임 제어</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleStartRound(1)} disabled={gameState?.isActive}
                className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/15 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/25">
                <Play className="w-3.5 h-3.5" /> 시작
              </button>
              <button onClick={handleStopRound} disabled={!gameState?.isActive}
                className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-red-500/15 text-red-400 border border-red-400/20 hover:bg-red-500/25">
                <Square className="w-3.5 h-3.5" /> 중지
              </button>
            </div>
            <button onClick={handleResetGame}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all bg-amber-500/15 text-amber-400 border border-amber-400/20 hover:bg-amber-500/25">
              <RotateCcw className="w-3.5 h-3.5" /> 초기화
            </button>
          </div>
          <div className="glass-gold glow-gold rounded-2xl p-4 flex flex-col items-center justify-center min-w-[140px]">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400/60" />
              <span className="text-[10px] text-amber-400/60 font-semibold uppercase tracking-wider">남은 시간</span>
            </div>
            <p className="text-3xl font-extrabold text-gradient-gold tabular-nums">
              {timer.minutes.toString().padStart(2, '0')}:{timer.seconds.toString().padStart(2, '0')}
            </p>
            <div className="mt-2 w-full h-1.5 rounded-full bg-black/20 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000"
                style={{ width: `${timer.progress * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Team Progress */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">팀별 진행 현황</h2>
            <span className="text-[10px] text-gray-600">각 팀 5개 장소 배정</span>
          </div>
          <div className="space-y-2.5">
            {TEAMS.map((team) => {
              const teamLocs = getTeamLocations(team.teamId)
              const positions = allPositions[team.teamId] || []
              const teamState = gameState?.teams[team.teamId]
              const foundCount = teamState?.unlockedLocation ? 1 : 0

              return (
                <div key={team.teamId} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        foundCount >= 5 ? 'bg-emerald-400/20 text-emerald-400' : foundCount > 0 ? 'bg-amber-400/15 text-amber-400' : 'bg-white/[0.06] text-gray-400'
                      }`}>{team.teamId}</div>
                      <div>
                        <span className="font-bold text-white text-sm">팀 {team.teamId}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Users className="w-3 h-3 text-gray-600" />
                          <span className="text-[10px] text-gray-500">{positions.length}명 접속</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-extrabold tabular-nums ${
                        foundCount >= 5 ? 'text-emerald-400' : foundCount > 0 ? 'text-amber-400' : 'text-gray-600'
                      }`}>{foundCount}</span>
                      <span className="text-gray-600 text-sm font-bold"> / 5</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div className={`h-full rounded-full ${
                      foundCount >= 5 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : foundCount > 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gray-700'
                    }`} initial={{ width: 0 }} animate={{ width: `${(foundCount / 5) * 100}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    {teamLocs.map((loc, idx) => (
                      <div key={loc.id} className="flex items-center gap-1">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center ${idx < foundCount ? 'bg-emerald-400/20' : 'bg-white/[0.04]'}`}>
                          {idx < foundCount ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <MapPin className="w-3 h-3 text-gray-600" />}
                        </div>
                        <span className={`text-[9px] font-medium ${idx < foundCount ? 'text-emerald-400/70' : 'text-gray-600'}`}>{loc.name.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
