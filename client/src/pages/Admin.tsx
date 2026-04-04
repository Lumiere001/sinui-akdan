import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'
import { useTimer } from '../hooks/useTimer'
import type { GameState, PlayerPosition } from '../../../shared/types'
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

  // Login screen
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}>
        <motion.div
          style={{ width: '100%', maxWidth: '300px' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', marginBottom: '16px',
            }}>
              🔒
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>관리자</h1>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>비밀번호를 입력하세요</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="비밀번호"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', color: 'rgba(255,255,255,0.9)', fontSize: '15px',
                fontFamily: "'Noto Serif KR', serif", outline: 'none',
              }}
              autoFocus
            />
            <button
              onClick={handlePasswordSubmit}
              style={{
                width: '100%', padding: '14px',
                background: 'rgba(255,255,255,0.9)', color: '#0a0a0f',
                border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700',
                cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
              }}
            >
              로그인
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Dashboard
  const totalPlayers = Object.values(allPositions).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>관리자 대시보드</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#6fea8d' : '#ff6b6b', display: 'inline-block' }} />
              {isConnected ? '연결됨' : '해제'}
            </span>
            <span>·</span>
            <span>{totalPlayers}명 접속</span>
          </div>
        </div>
        <button
          onClick={() => { setIsAuthenticated(false); navigate('/') }}
          style={{
            background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)',
            borderRadius: '8px', padding: '6px 14px', color: '#ff6b6b',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          나가기
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            flex: 1, padding: '16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: '600', marginBottom: '12px' }}>
              게임 제어
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button onClick={() => handleStartRound(1)} disabled={gameState?.isActive}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(100,255,150,0.2)',
                  background: 'rgba(100,255,150,0.08)', color: '#6fea8d', fontSize: '12px', fontWeight: '600',
                  cursor: gameState?.isActive ? 'not-allowed' : 'pointer', opacity: gameState?.isActive ? 0.3 : 1,
                }}>
                ▶ 시작
              </button>
              <button onClick={handleStopRound} disabled={!gameState?.isActive}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,100,100,0.2)',
                  background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', fontSize: '12px', fontWeight: '600',
                  cursor: !gameState?.isActive ? 'not-allowed' : 'pointer', opacity: !gameState?.isActive ? 0.3 : 1,
                }}>
                ■ 중지
              </button>
            </div>
            <button onClick={handleResetGame}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: '1px solid rgba(255,200,50,0.2)', background: 'rgba(255,200,50,0.08)',
                color: '#ffc832', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>
              ↻ 초기화
            </button>
          </div>

          {/* Timer */}
          <div style={{
            minWidth: '130px', padding: '16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.05em' }}>
              남은 시간
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
              {timer.minutes.toString().padStart(2, '0')}:{timer.seconds.toString().padStart(2, '0')}
            </div>
            <div style={{ marginTop: '8px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${timer.progress * 100}%`, background: 'linear-gradient(90deg, #6fea8d, #4ecdc4)', borderRadius: '2px', transition: 'width 1s' }} />
            </div>
          </div>
        </div>

        {/* Team Progress */}
        <div style={{
          padding: '18px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: '600' }}>
              팀별 진행 현황
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>각 팀 5개 장소</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {TEAMS.map((team) => {
              const teamLocs = getTeamLocations(team.teamId)
              const positions = allPositions[team.teamId] || []
              const teamState = gameState?.teams[team.teamId]
              const foundCount = teamState?.unlockedLocation ? 1 : 0

              return (
                <div key={team.teamId} style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: foundCount > 0 ? 'rgba(100,255,150,0.15)' : 'rgba(255,255,255,0.06)',
                        fontSize: '12px', fontWeight: '700', fontFamily: 'monospace',
                        color: foundCount > 0 ? '#6fea8d' : 'rgba(255,255,255,0.4)',
                      }}>
                        {team.teamId}
                      </span>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>팀 {team.teamId}</span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginLeft: '8px' }}>{positions.length}명</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'monospace', color: foundCount > 0 ? '#6fea8d' : 'rgba(255,255,255,0.2)' }}>
                      {foundCount}<span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px' }}>/5</span>
                    </div>
                  </div>

                  {/* Mini progress */}
                  <div style={{ height: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', overflow: 'hidden' }}>
                    <motion.div
                      style={{
                        height: '100%', borderRadius: '1px',
                        background: foundCount > 0 ? 'linear-gradient(90deg, #6fea8d, #4ecdc4)' : 'transparent',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(foundCount / 5) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  {/* Location names */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' as const }}>
                    {teamLocs.map((loc, idx) => (
                      <span key={loc.id} style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                        background: idx < foundCount ? 'rgba(100,255,150,0.1)' : 'rgba(255,255,255,0.03)',
                        color: idx < foundCount ? '#6fea8d' : 'rgba(255,255,255,0.25)',
                        border: `1px solid ${idx < foundCount ? 'rgba(100,255,150,0.15)' : 'rgba(255,255,255,0.04)'}`,
                      }}>
                        {loc.name.slice(0, 4)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
