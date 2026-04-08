import { useState, useEffect, useRef, useMemo } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { GameState, ChatMessage, PlayerPosition, TeamStage } from '../../../shared/types'

const ADMIN_PASSWORD = 'admin2024'

const TEAM_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
  6: '#8b5cf6', 7: '#ec4899', 8: '#14b8a6', 9: '#f59e0b', 10: '#6366f1',
}

declare global {
  interface Window { kakao: any }
}

// ========== Admin Map Component ==========
function AdminMap({ gameState, round }: { gameState: GameState | null; round: 1 | 2 | 3 }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

  // Load Kakao Maps API
  useEffect(() => {
    if (window.kakao?.maps?.LatLng) { setMapLoaded(true); return }
    if (window.kakao?.maps?.load) { window.kakao.maps.load(() => setMapLoaded(true)); return }
    const existing = document.querySelector('script[src*="dapi.kakao.com"]')
    if (existing) {
      const iv = setInterval(() => {
        if (window.kakao?.maps?.load) { clearInterval(iv); window.kakao.maps.load(() => setMapLoaded(true)) }
      }, 200)
      setTimeout(() => clearInterval(iv), 10000)
      return
    }
    const script = document.createElement('script')
    const apiKey = import.meta.env.VITE_KAKAO_MAP_KEY || '5cf7281a033392258ca9e620067aa6ad'
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`
    script.async = true
    script.onload = () => { window.kakao?.maps?.load ? window.kakao.maps.load(() => setMapLoaded(true)) : setMapError(true) }
    script.onerror = () => setMapError(true)
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return
    try {
      const { kakao } = window
      mapInstanceRef.current = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(35.1395, 126.9145),
        level: 4,
      })
      setTimeout(() => mapInstanceRef.current?.relayout(), 100)
    } catch { setMapError(true) }
  }, [mapLoaded])

  // Update team markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !gameState) return
    const { kakao } = window

    // Clear existing
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const teamIds = round === 1 ? [1, 2, 3, 4, 5] : round === 2 ? [6, 7, 8, 9, 10] : [11]

    teamIds.forEach(tId => {
      const team = gameState.teams[tId]
      if (!team) return
      const color = TEAM_COLORS[tId]

      Object.values(team.members).forEach((member: PlayerPosition) => {
        if (!member.lat || !member.lng) return

        // Create colored dot marker for this team member
        const canvas = document.createElement('canvas')
        canvas.width = 22; canvas.height = 22
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color + '30'
        ctx.beginPath(); ctx.arc(11, 11, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color + '80'
        ctx.beginPath(); ctx.arc(11, 11, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(11, 11, 4, 0, Math.PI * 2); ctx.fill()
        // Team number
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 7px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(tId), 11, 11)

        const img = new kakao.maps.MarkerImage(
          canvas.toDataURL(),
          new kakao.maps.Size(22, 22),
          { offset: new kakao.maps.Point(11, 11) },
        )
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(member.lat, member.lng),
          image: img,
          zIndex: 5,
        })
        marker.setMap(mapInstanceRef.current)
        markersRef.current.push(marker)
      })
    })
  }, [gameState, mapLoaded, round])

  // Relayout on resize
  useEffect(() => {
    if (!mapInstanceRef.current || !mapRef.current) return
    const obs = new ResizeObserver(() => mapInstanceRef.current?.relayout())
    obs.observe(mapRef.current)
    return () => obs.disconnect()
  }, [mapLoaded])

  if (mapError) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 200, background: '#0f1218', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 12 }}>지도를 불러올 수 없습니다</div>
      </div>
    )
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 200, background: '#0f1218' }} />
}

// ========== Main Admin Component ==========
export function Admin() {
  const { socket, isConnected } = useSocket()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [selectedChatTeam, setSelectedChatTeam] = useState<number>(1)
  const [activeRound, setActiveRound] = useState<1 | 2 | 3>(1)
  const [, setTick] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInitialized = useRef(false)
  const [lastReadCounts, setLastReadCounts] = useState<Record<number, number>>({})

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

    const joinAdmin = () => { socket.emit('admin:join', password) }
    joinAdmin()
    socket.on('connect', joinAdmin)

    socket.on('game:state', (state) => {
      setGameState(state)
      if (state.chatMessages && !chatInitialized.current) {
        setChatMessages(state.chatMessages)
        // Initialize read counts
        const counts: Record<number, number> = {}
        for (const [teamId, msgs] of Object.entries(state.chatMessages)) {
          counts[Number(teamId)] = msgs.length
        }
        setLastReadCounts(counts)
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

  // Scroll chat + mark as read
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Mark current chat team as read
    const currentMsgs = chatMessages[selectedChatTeam] || []
    setLastReadCounts(prev => ({ ...prev, [selectedChatTeam]: currentMsgs.length }))
  }, [chatMessages, selectedChatTeam])

  // Unread counts (only count participant messages, not admin)
  const unreadCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let t = 1; t <= 11; t++) {
      const msgs = chatMessages[t] || []
      const lastRead = lastReadCounts[t] || 0
      // Count only non-admin messages after the last read position
      let unread = 0
      for (let i = lastRead; i < msgs.length; i++) {
        if (!msgs[i].isAdmin) unread++
      }
      counts[t] = unread
    }
    return counts
  }, [chatMessages, lastReadCounts])

  // Pledge count per team
  const pledgeCounts = useMemo(() => {
    if (!gameState) return {} as Record<number, number>
    const counts: Record<number, number> = {}
    for (let t = 1; t <= 11; t++) counts[t] = 0
    Object.values(gameState.pledges).forEach(p => {
      if (counts[p.teamId] !== undefined) counts[p.teamId]++
    })
    return counts
  }, [gameState])

  // Admin actions
  function startTimer(teamId: number) { socket?.emit('admin:startTimer', teamId) }
  function stopTimer(teamId: number) { socket?.emit('admin:stopTimer', teamId) }
  function pauseTimer(teamId: number) { socket?.emit('admin:pauseTimer', teamId) }
  function resumeTimer(teamId: number) { socket?.emit('admin:resumeTimer', teamId) }
  function resetGame() {
    if (confirm('정말로 전체 게임을 초기화하시겠습니까?')) socket?.emit('admin:resetGame')
  }
  function resetTeam(teamId: number) {
    if (confirm(`팀 ${teamId}을(를) 재시작하시겠습니까?\n(진행상태, 서약, 타이머 모두 초기화)`)) {
      socket?.emit('admin:resetTeam', teamId)
    }
  }
  function setTeamStage(teamId: number, stage: TeamStage) { socket?.emit('admin:setStage', { teamId, stage }) }
  function stage1StartTimer(teamId: number) { socket?.emit('admin:stage1StartTimer', teamId) }
  function stage1StopTimer(teamId: number) { socket?.emit('admin:stage1StopTimer', teamId) }
  function stage1PauseTimer(teamId: number) { socket?.emit('admin:stage1PauseTimer', teamId) }
  function stage1ResumeTimer(teamId: number) { socket?.emit('admin:stage1ResumeTimer', teamId) }

  function sendChat() {
    if (!socket || !chatInput.trim()) return
    socket.emit('chat:send', { teamId: selectedChatTeam, message: chatInput.trim() })
    setChatInput('')
  }

  function getTeamTimerDisplay(teamId: number): string {
    const team = gameState?.teams[teamId]
    if (!team) return '--:--'
    if (team.isTimerPaused && team.timerRemainingAtPause !== null) {
      const remaining = team.timerRemainingAtPause
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
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

  function getStage1TimerDisplay(teamId: number): string {
    const team = gameState?.teams[teamId]
    if (!team) return '--:--'
    if (team.stage1TimerPaused && team.stage1TimerRemainingAtPause !== null) {
      const remaining = team.stage1TimerRemainingAtPause
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    if (!team.stage1TimerStartTime || !team.stage1TimerActive) {
      if (team.stage1TimerExpired) return '00:00'
      return '40:00'
    }
    const elapsed = Date.now() - team.stage1TimerStartTime
    const remaining = Math.max(0, team.stage1TimerDuration - elapsed)
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function getStepLabel(teamId: number): string {
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

  const totalPledges = gameState ? Object.keys(gameState.pledges).length : 0

  const roundTeams = activeRound === 1 ? [1, 2, 3, 4, 5] : activeRound === 2 ? [6, 7, 8, 9, 10] : [11]
  const selectedTeamMsgs = chatMessages[selectedChatTeam] || []

  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0)

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* ===== Header ===== */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f',
        borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🎼 관리자 대시보드</h1>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: isConnected ? '#6fea8d' : '#ef4444' }} />
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
              <span>👥 {connectedPlayers}명</span>
              <span>📜 서약 {totalPledges}명</span>
              {totalUnread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  💬 {totalUnread}
                </span>
              )}
            </div>
          </div>
          <button onClick={resetGame} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
          }}>초기화</button>
        </div>
      </div>

      {/* ===== Round Tabs ===== */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {([1, 2, 3] as const).map(r => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            style={{
              flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
              background: activeRound === r ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderBottom: activeRound === r ? '2px solid #d4a853' : '2px solid transparent',
              color: activeRound === r ? '#d4a853' : '#666',
              border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 2,
              cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
              transition: 'all 0.2s',
            }}
          >
            {r === 1 ? '🅰 라운드 1 (팀 1-5)' : r === 2 ? '🅱 라운드 2 (팀 6-10)' : '🧪 테스트 (팀 11)'}
          </button>
        ))}
      </div>

      {/* ===== Map Section ===== */}
      <div style={{ height: '28vh', minHeight: 180, borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        <AdminMap gameState={gameState} round={activeRound} />
        {/* Map legend */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 6, flexWrap: 'wrap',
          background: 'rgba(10,10,15,0.85)', borderRadius: 6, padding: '5px 8px',
        }}>
          {roundTeams.map(tId => (
            <span key={tId} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#aaa' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TEAM_COLORS[tId], display: 'inline-block' }} />
              {tId}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* ===== Team Cards ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
          {roundTeams.map(tId => {
            const team = gameState?.teams[tId]
            const memberCount = team ? Object.keys(team.members).length : 0
            const color = TEAM_COLORS[tId]
            const teamStage = team?.stage || 'idle'
            const isActive = team?.isTimerActive
            const isPaused = team?.isTimerPaused
            const isExpired = team?.isTimerExpired
            const isDone = team?.isComplete
            const s1Active = team?.stage1TimerActive
            const s1Paused = team?.stage1TimerPaused
            const s1Expired = team?.stage1TimerExpired
            const pCount = pledgeCounts[tId] || 0
            const teamUnread = unreadCounts[tId] || 0

            // Stage-based styling
            const stageBorderColor = teamUnread > 0 ? 'rgba(59,130,246,0.3)'
              : teamStage === 'stage1' ? 'rgba(168,85,247,0.25)'
              : teamStage === 'stage1_ready' ? 'rgba(168,85,247,0.15)'
              : teamStage === 'stage2' ? 'rgba(59,130,246,0.25)'
              : teamStage === 'stage2_ready' ? 'rgba(59,130,246,0.15)'
              : isDone ? 'rgba(111,234,141,0.2)' : isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'
            const stageBgColor = teamUnread > 0 ? 'rgba(59,130,246,0.04)'
              : teamStage === 'stage1' ? 'rgba(168,85,247,0.04)'
              : teamStage === 'stage2' ? 'rgba(59,130,246,0.04)'
              : isDone ? 'rgba(111,234,141,0.06)' : isExpired ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)'
            const stageBadgeConfig: Record<string, { label: string; color: string; bg: string }> = {
              idle: { label: '대기', color: '#666', bg: 'rgba(255,255,255,0.04)' },
              stage1_ready: { label: 'S1 준비', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
              stage1: { label: 'Stage 1', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
              stage2_ready: { label: 'S2 준비', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
              stage2: { label: 'Stage 2', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
            }
            const badge = stageBadgeConfig[teamStage] || stageBadgeConfig.idle

            return (
              <div key={tId} style={{
                padding: '12px', borderRadius: 10, position: 'relative',
                background: stageBgColor,
                border: `1px solid ${stageBorderColor}`,
              }}>
                {/* Unread indicator dot */}
                {teamUnread > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#3b82f6', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                  }}>{teamUnread}</span>
                )}

                {/* Stage badge bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: badge.bg, color: badge.color, letterSpacing: 0.5,
                    border: `1px solid ${badge.color}30`,
                  }}>{badge.label}</span>
                  {teamStage === 'stage2' && (
                    <span style={{ fontSize: 10, color: '#666' }}>단계 {getStepLabel(tId)}</span>
                  )}
                  {(teamStage === 'stage1' && s1Active) && (
                    <span style={{ fontSize: 10, color: '#a855f7' }}>진행 중</span>
                  )}
                  {(teamStage === 'stage1' && s1Expired) && (
                    <span style={{ fontSize: 10, color: '#ef4444' }}>시간 종료</span>
                  )}
                </div>

                {/* Team header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${color}20`, color, fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                    }}>{tId}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        팀 {tId}
                        {teamUnread > 0 && (
                          <span style={{
                            background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '1px 7px',
                            fontSize: 10, fontWeight: 700, lineHeight: '16px',
                          }}>💬 {teamUnread}개 안 읽음</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', display: 'flex', gap: 6 }}>
                        <span>👥 {memberCount}명</span>
                        <span>📜 {pCount}명</span>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 16, fontWeight: 600,
                    color: (teamStage === 'stage1' || teamStage === 'stage1_ready')
                      ? (s1Active ? '#a855f7' : s1Paused ? '#f59e0b' : s1Expired ? '#ef4444' : '#555')
                      : (isActive ? '#6fea8d' : isPaused ? '#f59e0b' : isExpired ? '#ef4444' : '#555'),
                  }}>
                    {(teamStage === 'stage1' || teamStage === 'stage1_ready')
                      ? (s1Paused ? `⏸ ${getStage1TimerDisplay(tId)}` : getStage1TimerDisplay(tId))
                      : (isPaused ? `⏸ ${getTeamTimerDisplay(tId)}` : getTeamTimerDisplay(tId))
                    }
                  </div>
                </div>

                {/* Stage progress indicator */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                  {/* Stage 1 indicator */}
                  <div style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: teamStage === 'stage1' ? (s1Active ? '#a855f7' : s1Expired ? '#ef4444' : 'rgba(168,85,247,0.3)')
                      : (teamStage === 'stage2' || teamStage === 'stage2_ready') ? '#a855f7'
                      : teamStage === 'stage1_ready' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.3s',
                  }} />
                  {/* Stage 2 steps */}
                  {[1, 2, 3].map(step => {
                    const completed = team?.completedSteps.includes(step)
                    const current = step === team?.currentStep && !team?.isComplete
                    const isStage2 = teamStage === 'stage2' || teamStage === 'stage2_ready'
                    return (
                      <div key={step} style={{ flex: 1, position: 'relative' }}>
                        <div style={{
                          height: 4, borderRadius: 2,
                          background: completed ? '#6fea8d' : current ? '#d4a853' : isStage2 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.08)',
                          transition: 'background 0.3s',
                        }} />
                        <span style={{
                          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 8, color: completed ? '#6fea8d' : current ? '#d4a853' : '#444',
                        }}>
                          {completed ? '✓' : step}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Team members list */}
                {memberCount > 0 && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>접속 멤버</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.keys(team!.members).map(pid => {
                        const name = pid.includes('_') ? pid.split('_').slice(1).join('_') : pid
                        const isRep = team!.representative === pid
                        return (
                          <span key={pid} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '3px 8px', borderRadius: 12, fontSize: 11,
                            background: isRep ? 'rgba(111,234,141,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isRep ? 'rgba(111,234,141,0.25)' : 'rgba(255,255,255,0.06)'}`,
                            color: isRep ? '#6fea8d' : '#aaa',
                            fontWeight: isRep ? 600 : 400,
                          }}>
                            {isRep && <span style={{ fontSize: 10 }}>👑</span>}
                            {name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Stage + Timer controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {/* Stage selector */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['stage1_ready', 'stage2_ready'] as const).map(s => {
                      const label = s === 'stage1_ready' ? 'S1 준비' : 'S2 준비'
                      const active = teamStage === s || (s === 'stage1_ready' && teamStage === 'stage1') || (s === 'stage2_ready' && teamStage === 'stage2')
                      return (
                        <button key={s} onClick={() => {
                          const hasActiveS1 = s1Active || s1Paused
                          const hasActiveS2 = isActive || isPaused
                          if (s === 'stage2_ready' && hasActiveS1) {
                            if (!window.confirm('Stage 1 타이머가 진행 중입니다. Stage 2 준비로 전환하시겠습니까?')) return
                          }
                          if (s === 'stage1_ready' && hasActiveS2) {
                            if (!window.confirm('Stage 2 타이머가 진행 중입니다. Stage 1 준비로 전환하시겠습니까?')) return
                          }
                          setTeamStage(tId, s)
                        }}
                          style={{
                            flex: 1, padding: '5px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                            background: active ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${active ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.04)'}`,
                            color: active ? '#d4a853' : '#555',
                            cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                          }}
                        >{label}</button>
                      )
                    })}
                  </div>

                  {/* Timer controls - changes based on stage */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(teamStage === 'stage1_ready' || teamStage === 'stage1') ? (
                      <>
                        <button onClick={() => stage1StartTimer(tId)}
                          disabled={s1Active || s1Paused}
                          style={{
                            flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: s1Active || s1Paused ? 'rgba(255,255,255,0.02)' : 'rgba(111,234,141,0.08)',
                            border: `1px solid ${s1Active || s1Paused ? 'rgba(255,255,255,0.04)' : 'rgba(111,234,141,0.2)'}`,
                            color: s1Active || s1Paused ? '#444' : '#6fea8d',
                            cursor: s1Active || s1Paused ? 'not-allowed' : 'pointer',
                            fontFamily: "'Noto Serif KR', serif",
                          }}
                        >▶ S1 시작</button>
                        {s1Paused ? (
                          <button onClick={() => stage1ResumeTimer(tId)}
                            style={{
                              flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: 'rgba(111,234,141,0.08)', border: '1px solid rgba(111,234,141,0.2)',
                              color: '#6fea8d', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                            }}
                          >▶ 재개</button>
                        ) : (
                          <button onClick={() => stage1PauseTimer(tId)}
                            disabled={!s1Active}
                            style={{
                              flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: !s1Active ? 'rgba(255,255,255,0.02)' : 'rgba(245,158,11,0.08)',
                              border: `1px solid ${!s1Active ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.2)'}`,
                              color: !s1Active ? '#444' : '#f59e0b',
                              cursor: !s1Active ? 'not-allowed' : 'pointer',
                              fontFamily: "'Noto Serif KR', serif",
                            }}
                          >⏸</button>
                        )}
                        <button onClick={() => stage1StopTimer(tId)}
                          disabled={!s1Active && !s1Paused}
                          style={{
                            padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: !s1Active && !s1Paused ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${!s1Active && !s1Paused ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.2)'}`,
                            color: !s1Active && !s1Paused ? '#444' : '#f87171',
                            cursor: !s1Active && !s1Paused ? 'not-allowed' : 'pointer',
                            fontFamily: "'Noto Serif KR', serif",
                          }}
                        >■</button>
                      </>
                    ) : (teamStage === 'stage2_ready' || teamStage === 'stage2') ? (
                      <>
                        <button onClick={() => startTimer(tId)}
                          disabled={isActive || isPaused || isDone}
                          style={{
                            flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: isActive || isPaused || isDone ? 'rgba(255,255,255,0.02)' : 'rgba(111,234,141,0.08)',
                            border: `1px solid ${isActive || isPaused || isDone ? 'rgba(255,255,255,0.04)' : 'rgba(111,234,141,0.2)'}`,
                            color: isActive || isPaused || isDone ? '#444' : '#6fea8d',
                            cursor: isActive || isPaused || isDone ? 'not-allowed' : 'pointer',
                            fontFamily: "'Noto Serif KR', serif",
                          }}
                        >▶ S2 시작</button>
                        {isPaused ? (
                          <button onClick={() => resumeTimer(tId)}
                            style={{
                              flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: 'rgba(111,234,141,0.08)', border: '1px solid rgba(111,234,141,0.2)',
                              color: '#6fea8d', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                            }}
                          >▶ 재개</button>
                        ) : (
                          <button onClick={() => pauseTimer(tId)}
                            disabled={!isActive}
                            style={{
                              flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: !isActive ? 'rgba(255,255,255,0.02)' : 'rgba(245,158,11,0.08)',
                              border: `1px solid ${!isActive ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.2)'}`,
                              color: !isActive ? '#444' : '#f59e0b',
                              cursor: !isActive ? 'not-allowed' : 'pointer',
                              fontFamily: "'Noto Serif KR', serif",
                            }}
                          >⏸</button>
                        )}
                        <button onClick={() => stopTimer(tId)}
                          disabled={!isActive && !isPaused}
                          style={{
                            padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: !isActive && !isPaused ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${!isActive && !isPaused ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.2)'}`,
                            color: !isActive && !isPaused ? '#444' : '#f87171',
                            cursor: !isActive && !isPaused ? 'not-allowed' : 'pointer',
                            fontFamily: "'Noto Serif KR', serif",
                          }}
                        >■</button>
                      </>
                    ) : (
                      <div style={{ flex: 1, padding: '7px', fontSize: 11, color: '#555', textAlign: 'center' }}>
                        스테이지를 선택하세요
                      </div>
                    )}
                    <button
                      onClick={() => { setSelectedChatTeam(tId); document.getElementById('admin-chat-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                      style={{
                        padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                        color: '#60a5fa', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                        position: 'relative',
                      }}
                    >
                      💬
                      {teamUnread > 0 && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4,
                          background: '#ef4444', color: '#fff', borderRadius: '50%',
                          width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 700,
                        }}>{teamUnread}</span>
                      )}
                    </button>
                    <button
                      onClick={() => resetTeam(tId)}
                      style={{
                        padding: '7px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                        color: '#f59e0b', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                      }}
                    >↺</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ===== Chat Section ===== */}
        <div id="admin-chat-section">
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            팀 채팅
          </div>

          {/* Team chat tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {Array.from({ length: 11 }, (_, i) => i + 1).map(tId => {
              const unread = unreadCounts[tId] || 0
              const isSelected = selectedChatTeam === tId
              return (
                <button
                  key={tId}
                  onClick={() => setSelectedChatTeam(tId)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: isSelected ? `${TEAM_COLORS[tId]}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? `${TEAM_COLORS[tId]}40` : 'rgba(255,255,255,0.04)'}`,
                    color: isSelected ? TEAM_COLORS[tId] : '#666',
                    cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
                    position: 'relative',
                  }}
                >
                  {tId}
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5,
                      background: '#ef4444', color: '#fff', borderRadius: '50%',
                      width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>{unread}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Chat messages */}
          <div style={{
            height: 280, overflowY: 'auto', padding: 12, borderRadius: 10,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 8,
          }}>
            {selectedTeamMsgs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 40 }}>
                팀 {selectedChatTeam}의 메시지가 없습니다
              </div>
            ) : (
              selectedTeamMsgs.map((msg, i) => (
                <div key={msg.id || i} style={{
                  marginBottom: 8,
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.isAdmin ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>
                    {msg.senderName} · {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    padding: '7px 11px', borderRadius: 8, maxWidth: '80%',
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
                flex: 1, padding: '11px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#e0e0e0', fontSize: 13, outline: 'none',
                fontFamily: "'Noto Serif KR', serif",
              }}
            />
            <button onClick={sendChat} style={{
              padding: '11px 18px', borderRadius: 8,
              background: chatInput.trim() ? '#3b82f6' : 'rgba(255,255,255,0.04)',
              color: chatInput.trim() ? '#fff' : '#444',
              border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, fontFamily: "'Noto Serif KR', serif",
            }}>전송</button>
          </div>
        </div>
      </div>
    </div>
  )
}
