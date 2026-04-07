import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { GameState, ChatMessage } from '../../../shared/types'

const ADMIN_PASSWORD = 'admin2024'

const TEAM_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
  6: '#8b5cf6', 7: '#ec4899', 8: '#14b8a6', 9: '#f59e0b', 10: '#6366f1',
}

export function Admin() {
  const { socket, isConnected } = useSocket()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [selectedChatTeam, setSelectedChatTeam] = useState<number>(1)
  const [, setTick] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInitialized = useRef(false)

  // Admin login
  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true)
      setLoginError(false)
    } else {
      setLoginError(true)
    }
  }

  // Socket events
  useEffect(() => {
    if (!socket || !isLoggedIn) return

    const joinAdmin = () => {
      socket.emit('admin:join', password)
    }
    joinAdmin()
    socket.on('connect', joinAdmin)

    socket.on('game:state', (state) => {
      setGameState(state)
      // Only load chat from game:state on first connect (avoid overwriting live messages)
      if (state.chatMessages && !chatInitialized.current) {
        setChatMessages(state.chatMessages)
        chatInitialized.current = true
      }
    })

    socket.on('chat:message', (msg) => {
      setChatMessages(prev => {
        const teamMsgs = prev[msg.teamId] || []
        return { ...prev, [msg.teamId]: [...teamMsgs, msg] }
      })
    })

    socket.on('chat:history', (msgs) => {
      if (msgs.length > 0) {
        const teamId = msgs[0].teamId
        setChatMessages(prev => ({ ...prev, [teamId]: msgs }))
      }
    })

    return () => {
      socket.off('game:state')
      socket.off('connect', joinAdmin)
      socket.off('chat:message')
      socket.off('chat:history')
    }
  }, [socket, isLoggedIn, password])

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, selectedChatTeam])

  // Admin actions
  function startTimer(teamId: number) {
    socket?.emit('admin:startTimer', teamId)
  }
  function stopTimer(teamId: number) {
    socket?.emit('admin:stopTimer', teamId)
  }
  function resetGame() {
    if (confirm('정말로 게임을 초기화하시겠습니까?')) {
      socket?.emit('admin:resetGame')
    }
  }
  function sendChat() {
    if (!socket || !chatInput.trim()) return
    socket.emit('chat:send', { teamId: selectedChatTeam, message: chatInput.trim() })
    // Server will echo back via chat:message — no optimistic add needed
    setChatInput('')
  }

  // Timer display helper
  function getTeamTimerDisplay(teamId: number): string {
    const team = gameState?.teams[teamId]
    if (!team) return '--:--'
    if (!team.timerStartTime || !team.isTimerActive) {
      if (team.isTimerExpired) return '00:00'
      return '30:00'
    }
    const elapsed = Date.now() - team.timerStartTime
    const remaining = Math.max(0, team.timerDuration - elapsed)
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Step display
  function getStepDisplay(teamId: number): string {
    const team = gameState?.teams[teamId]
    if (!team) return '-'
    if (team.isComplete) return '완료'
    if (team.currentStep === 0) return '대기'
    return `${team.currentStep}/3`
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Serif KR', serif" }}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0' }}>관리자 로그인</h1>
          </div>
          <input
            type="password" placeholder="관리자 비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              fontFamily: "'Noto Serif KR', serif",
            }}
          />
          {loginError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>비밀번호가 틀렸습니다</div>}
          <button onClick={handleLogin} style={{
            width: '100%', padding: '14px', borderRadius: 8,
            background: '#fff', color: '#0a0a0f', fontWeight: 700, fontSize: 14,
            border: 'none', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
          }}>로그인</button>
        </div>
      </div>
    )
  }

  const connectedPlayers = gameState
    ? Object.values(gameState.teams).reduce((sum, t) => sum + Object.keys(t.members).length, 0)
    : 0

  const selectedTeamMsgs = chatMessages[selectedChatTeam] || []

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f',
        borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🎼 관리자 대시보드</h1>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 4,
                background: isConnected ? '#6fea8d' : '#ef4444',
              }} />
              {isConnected ? '연결됨' : '연결 끊김'} · 접속자 {connectedPlayers}명
            </div>
          </div>
          <button onClick={resetGame} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
          }}>
            게임 초기화
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Team cards grid */}
        <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
          팀 현황
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 24 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(tId => {
            const team = gameState?.teams[tId]
            const memberCount = team ? Object.keys(team.members).length : 0
            const color = TEAM_COLORS[tId]
            const isActive = team?.isTimerActive
            const isExpired = team?.isTimerExpired
            const isDone = team?.isComplete

            return (
              <div key={tId} style={{
                padding: '14px', borderRadius: 10,
                background: isDone ? 'rgba(111,234,141,0.06)' : isExpired ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isDone ? 'rgba(111,234,141,0.2)' : isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${color}20`, color, fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                    }}>{tId}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>팀 {tId}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>👥 {memberCount}명 · 단계 {getStepDisplay(tId)}</div>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 16, fontWeight: 600,
                    color: isActive ? '#6fea8d' : isExpired ? '#ef4444' : '#555',
                  }}>
                    {getTeamTimerDisplay(tId)}
                  </div>
                </div>

                {/* Step progress */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                  {[1, 2, 3].map(step => {
                    const completed = team?.completedSteps.includes(step)
                    const current = step === team?.currentStep && !team?.isComplete
                    return (
                      <div key={step} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: completed ? '#6fea8d' : current ? '#d4a853' : 'rgba(255,255,255,0.08)',
                      }} />
                    )
                  })}
                </div>

                {/* Timer controls */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => startTimer(tId)}
                    disabled={isActive || isDone}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: isActive || isDone ? 'rgba(255,255,255,0.02)' : 'rgba(111,234,141,0.08)',
                      border: `1px solid ${isActive || isDone ? 'rgba(255,255,255,0.04)' : 'rgba(111,234,141,0.2)'}`,
                      color: isActive || isDone ? '#444' : '#6fea8d',
                      cursor: isActive || isDone ? 'not-allowed' : 'pointer',
                      fontFamily: "'Noto Serif KR', serif",
                    }}
                  >▶ 시작</button>
                  <button
                    onClick={() => stopTimer(tId)}
                    disabled={!isActive}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: !isActive ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${!isActive ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.2)'}`,
                      color: !isActive ? '#444' : '#f87171',
                      cursor: !isActive ? 'not-allowed' : 'pointer',
                      fontFamily: "'Noto Serif KR', serif",
                    }}
                  >■ 중지</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Chat section */}
        <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
          팀 채팅
        </div>

        {/* Team selector tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(tId => {
            const hasMessages = (chatMessages[tId]?.length || 0) > 0
            return (
              <button
                key={tId}
                onClick={() => setSelectedChatTeam(tId)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: selectedChatTeam === tId ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedChatTeam === tId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                  color: selectedChatTeam === tId ? '#fff' : '#666',
                  cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                  position: 'relative',
                }}
              >
                팀{tId}
                {hasMessages && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: TEAM_COLORS[tId],
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Chat messages */}
        <div style={{
          height: 300, overflowY: 'auto', padding: 14, borderRadius: 10,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 10,
        }}>
          {selectedTeamMsgs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 40 }}>
              팀 {selectedChatTeam}의 메시지가 없습니다
            </div>
          ) : (
            selectedTeamMsgs.map((msg, i) => (
              <div key={msg.id || i} style={{
                marginBottom: 10,
                display: 'flex', flexDirection: 'column',
                alignItems: msg.isAdmin ? 'flex-end' : 'flex-start',
              }}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>
                  {msg.senderName} · {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 8, maxWidth: '80%',
                  background: msg.isAdmin ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  {msg.message}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" placeholder={`팀 ${selectedChatTeam}에게 메시지...`}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChat() }}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e0', fontSize: 13, outline: 'none',
              fontFamily: "'Noto Serif KR', serif",
            }}
          />
          <button onClick={sendChat} style={{
            padding: '12px 20px', borderRadius: 8,
            background: chatInput.trim() ? '#3b82f6' : 'rgba(255,255,255,0.04)',
            color: chatInput.trim() ? '#fff' : '#444',
            border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 600, fontFamily: "'Noto Serif KR', serif",
          }}>
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
