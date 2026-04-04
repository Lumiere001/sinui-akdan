import { useState, useEffect } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { GameState } from '../../../shared/types'

const ADMIN_PASSWORD = 'admin2024'

export function Admin() {
  const { socket, isConnected } = useSocket()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [, setTick] = useState(0)

  // Admin 로그인
  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true)
      setLoginError(false)
    } else {
      setLoginError(true)
    }
  }

  // Socket 이벤트
  useEffect(() => {
    if (!socket || !isLoggedIn) return

    socket.on('game:state', (state) => {
      setGameState(state)
    })

    // admin 룸에 참가
    socket.emit('admin:join')

    return () => {
      socket.off('game:state')
    }
  }, [socket, isLoggedIn])

  // 타이머 틱 (1초마다 리렌더)
  useEffect(() => {
    if (!gameState?.isActive) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [gameState?.isActive])

  // 라운드 시작
  function startRound(round: number) {
    socket?.emit('admin:startRound', round)
  }

  // 라운드 중지
  function stopRound() {
    socket?.emit('admin:stopRound')
  }

  // 게임 초기화
  function resetGame() {
    socket?.emit('admin:resetGame')
  }

  // 타이머 계산
  function getTimerDisplay(): string {
    if (!gameState?.isActive || !gameState.startTime) return '00:00'
    const elapsed = Date.now() - gameState.startTime
    const remaining = Math.max(0, gameState.duration - elapsed)
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Serif KR', serif" }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0' }}>관리자 로그인</h1>
          </div>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              fontFamily: "'Noto Serif KR', serif",
            }}
          />
          {loginError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>비밀번호가 틀렸습니다</div>}
          <button
            onClick={handleLogin}
            style={{
              width: '100%', padding: '14px', borderRadius: 8,
              background: '#fff', color: '#0a0a0f', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
            }}
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  const currentRound = gameState?.currentRound || 1
  const roundTeams = currentRound === 1 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]
  const connectedPlayers = gameState
    ? Object.values(gameState.teams).reduce((sum, t) => sum + Object.keys(t.members).length, 0)
    : 0

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f',
        borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🎼 관리자</h1>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 4,
                background: isConnected ? '#6fea8d' : '#ef4444',
              }} />
              {isConnected ? '연결됨' : '연결 끊김'} · 접속자 {connectedPlayers}명
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 600, color: gameState?.isActive ? '#6fea8d' : '#888' }}>
            {getTimerDisplay()}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* 라운드 제어 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            라운드 제어
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => startRound(1)}
              disabled={gameState?.isActive}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: currentRound === 1 && gameState?.isActive ? 'rgba(111,234,141,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${currentRound === 1 && gameState?.isActive ? 'rgba(111,234,141,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: '#e0e0e0', cursor: gameState?.isActive ? 'not-allowed' : 'pointer',
                opacity: gameState?.isActive ? 0.5 : 1,
                fontFamily: "'Noto Serif KR', serif",
              }}
            >
              ▶ R1 시작 (1~5팀)
            </button>
            <button
              onClick={() => startRound(2)}
              disabled={gameState?.isActive}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: currentRound === 2 && gameState?.isActive ? 'rgba(111,234,141,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${currentRound === 2 && gameState?.isActive ? 'rgba(111,234,141,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: '#e0e0e0', cursor: gameState?.isActive ? 'not-allowed' : 'pointer',
                opacity: gameState?.isActive ? 0.5 : 1,
                fontFamily: "'Noto Serif KR', serif",
              }}
            >
              ▶ R2 시작 (6~10팀)
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={stopRound}
              disabled={!gameState?.isActive}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171', cursor: !gameState?.isActive ? 'not-allowed' : 'pointer',
                opacity: !gameState?.isActive ? 0.5 : 1,
                fontFamily: "'Noto Serif KR', serif",
              }}
            >
              ■ 중지
            </button>
            <button
              onClick={resetGame}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#888', cursor: 'pointer',
                fontFamily: "'Noto Serif KR', serif",
              }}
            >
              ↻ 초기화
            </button>
          </div>
        </div>

        {/* 현재 라운드 팀 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            라운드 {currentRound} · {gameState?.isActive ? '진행 중' : '대기'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roundTeams.map((tId) => {
              const team = gameState?.teams[tId]
              const memberCount = team ? Object.keys(team.members).length : 0
              const hasUnlocked = !!team?.unlockedLocation

              return (
                <div key={tId} style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: hasUnlocked ? 'rgba(111,234,141,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${hasUnlocked ? 'rgba(111,234,141,0.2)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: hasUnlocked ? 'rgba(111,234,141,0.15)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                        color: hasUnlocked ? '#6fea8d' : '#888',
                      }}>
                        {tId}
                      </span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>팀 {tId}</div>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                          👥 {memberCount}명 접속
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {hasUnlocked ? (
                        <span style={{ fontSize: 12, color: '#6fea8d', fontWeight: 600 }}>
                          ✓ 해금 (장소 {team?.unlockedLocation})
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#888' }}>탐색 중</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 비활성 라운드 팀 */}
        <div>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            {currentRound === 1 ? '라운드 2 팀 (대기)' : '라운드 1 팀'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(currentRound === 1 ? [6, 7, 8, 9, 10] : [1, 2, 3, 4, 5]).map((tId) => {
              const team = gameState?.teams[tId]
              const memberCount = team ? Object.keys(team.members).length : 0
              return (
                <div key={tId} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)',
                  color: '#666',
                }}>
                  팀{tId} · {memberCount}명
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
