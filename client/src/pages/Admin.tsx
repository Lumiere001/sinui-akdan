import { useState, useEffect, useRef, useMemo } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { GameState, ChatMessage, PlayerPosition, TeamStage } from '../../../shared/types'
import { getCurrentStageInfo, getStageSequence } from '../../../shared/types'
import { colors, typography, spacing, radius, transitions } from '../theme'
import { getTeamName, getTeamLabel } from '../data/gameData'

const ADMIN_PASSWORD = 'admin2024'

const TEAM_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
  6: '#8b5cf6', 7: '#ec4899', 8: '#14b8a6', 9: '#f59e0b', 10: '#6366f1',
}

declare global {
  interface Window { kakao: any }
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ========== Admin Map Component ==========
function AdminMap({ gameState, round }: { gameState: GameState | null; round: 1 | 2 }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

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

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !gameState) return
    const { kakao } = window

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const teamIds = round === 1 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]

    teamIds.forEach(tId => {
      const team = gameState.teams[tId]
      if (!team) return
      const color = TEAM_COLORS[tId]

      Object.values(team.members).forEach((member: PlayerPosition) => {
        if (!member.lat || !member.lng) return

        const canvas = document.createElement('canvas')
        canvas.width = 22; canvas.height = 22
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = color + '30'
        ctx.beginPath(); ctx.arc(11, 11, 10, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color + '80'
        ctx.beginPath(); ctx.arc(11, 11, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(11, 11, 4, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = colors.textPrimary
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

  useEffect(() => {
    if (!mapInstanceRef.current || !mapRef.current) return
    const obs = new ResizeObserver(() => mapInstanceRef.current?.relayout())
    obs.observe(mapRef.current)
    return () => obs.disconnect()
  }, [mapLoaded])

  if (mapError) {
    return (
      <div style={{ width: '100%', height: '100%', minHeight: 200, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: typography.sm }}>지도를 불러올 수 없습니다</div>
      </div>
    )
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 200, background: colors.bg }} />
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
  const [activeRound, setActiveRound] = useState<1 | 2>(1)
  const [, setTick] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInitialized = useRef(false)
  const [lastReadCounts, setLastReadCounts] = useState<Record<number, number>>({})

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

    socket.on('admin:allPositions', (allPositions: Record<number, any[]>) => {
      setGameState(prev => {
        if (!prev) return prev
        const updated = { ...prev, teams: { ...prev.teams } }
        for (const [teamId, positions] of Object.entries(allPositions)) {
          const tId = Number(teamId)
          if (updated.teams[tId]) {
            const members: Record<string, any> = {}
            positions.forEach((p: any) => { members[p.playerId] = p })
            updated.teams[tId] = { ...updated.teams[tId], members }
          }
        }
        return updated
      })
    })

    return () => {
      socket.off('game:state')
      socket.off('connect', joinAdmin)
      socket.off('chat:message')
      socket.off('chat:history')
      socket.off('admin:allPositions')
    }
  }, [socket, isLoggedIn, password])

  // Timer tick (for display updates)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Scroll chat + mark as read
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    const currentMsgs = chatMessages[selectedChatTeam] || []
    setLastReadCounts(prev => ({ ...prev, [selectedChatTeam]: currentMsgs.length }))
  }, [chatMessages, selectedChatTeam])

  // Unread counts
  const unreadCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let t = 1; t <= 10; t++) {
      const msgs = chatMessages[t] || []
      const lastRead = lastReadCounts[t] || 0
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
    for (let t = 1; t <= 10; t++) counts[t] = 0
    Object.values(gameState.pledges).forEach(p => {
      if (counts[p.teamId] !== undefined) counts[p.teamId]++
    })
    return counts
  }, [gameState])

  // V3 Admin Actions
  function masterStart() {
    if (confirm('전체 팀을 동시에 시작하시겠습니까?')) {
      socket?.emit('admin:masterStart')
    }
  }
  function recordStage1Complete(teamId: number) {
    socket?.emit('admin:recordStage1Complete', teamId)
  }
  function forceAdvanceStep(teamId: number) {
    const team = gameState?.teams[teamId]
    if (!team) return
    if (confirm(`${getTeamLabel(teamId)}의 Stage 2 ${team.currentStep}단계를 수동 해금하시겠습니까?`)) {
      socket?.emit('admin:forceAdvanceStep', teamId)
    }
  }
  function skipStage(teamId: number) {
    if (confirm(`${getTeamLabel(teamId)}의 현재 Stage를 건너뛰시겠습니까?`)) {
      socket?.emit('admin:skipStage', teamId)
    }
  }
  function toggleTestMode() {
    socket?.emit('admin:toggleTestMode')
  }
  function resetGame() {
    if (confirm('정말로 전체 게임을 초기화하시겠습니까?')) socket?.emit('admin:resetGame')
  }
  function resetTeam(teamId: number) {
    if (confirm(`${getTeamLabel(teamId)}을(를) 재시작하시겠습니까?\n(진행상태, 서약 모두 초기화)`)) {
      socket?.emit('admin:resetTeam', teamId)
    }
  }
  function sendChat() {
    if (!socket || !chatInput.trim()) return
    socket.emit('chat:send', { teamId: selectedChatTeam, message: chatInput.trim() })
    setChatInput('')
  }

  // V3: Get team's current stage info (벽시계 기반)
  function getTeamStageInfo(teamId: number) {
    const team = gameState?.teams[teamId]
    if (!team || !team.startTime || !gameState) return { stage: 'idle' as TeamStage, remaining: 0, stageIndex: -1 }
    const info = getCurrentStageInfo(team.startTime, team.group, gameState.durations)
    return { stage: info.stage, remaining: info.stageRemaining, stageIndex: info.stageIndex }
  }

  function getStepLabel(teamId: number): string {
    const team = gameState?.teams[teamId]
    if (!team) return '-'
    if (team.stage2CompletedAt) {
      // 소요 시간 계산
      if (team.startTime && gameState) {
        const sequence = getStageSequence(team.group)
        const stage2Index = sequence.indexOf('stage2')
        let stage2Start = team.startTime
        for (let i = 0; i < stage2Index; i++) {
          stage2Start += gameState.durations[sequence[i]]
        }
        const elapsedMs = team.stage2CompletedAt - stage2Start
        const totalSec = Math.max(0, Math.floor(elapsedMs / 1000))
        const min = Math.floor(totalSec / 60)
        const sec = totalSec % 60
        return `완료 (${min}분 ${sec}초)`
      }
      return '완료'
    }
    if (team.currentStep === 0) return '대기'
    return `${team.currentStep}/3`
  }

  function getS1ElapsedLabel(teamId: number): string | null {
    const team = gameState?.teams[teamId]
    if (!team || !team.stage1CompletedAt || !team.startTime || !gameState) return null
    const sequence = getStageSequence(team.group)
    const stage1Index = sequence.indexOf('stage1')
    let stage1Start = team.startTime
    for (let i = 0; i < stage1Index; i++) {
      stage1Start += gameState.durations[sequence[i]]
    }
    const elapsedMs = team.stage1CompletedAt - stage1Start
    const totalSec = Math.max(0, Math.floor(elapsedMs / 1000))
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}분 ${sec}초`
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: typography.fontFamily }}>
        <div style={{ width: '100%', maxWidth: 360, padding: `0 ${spacing.lg}px` }}>
          <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
            <div style={{ fontSize: 36, marginBottom: spacing.md }}>🔒</div>
            <h1 style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary }}>관리자 로그인</h1>
          </div>
          <input
            type="password" placeholder="관리자 비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: radius.md, marginBottom: spacing.sm,
              background: colors.borderLight, border: `1px solid ${colors.border}`,
              color: colors.textPrimary, fontSize: typography.base, outline: 'none', boxSizing: 'border-box',
              fontFamily: typography.fontFamily,
            }}
          />
          {loginError && <div style={{ fontSize: typography.sm, color: colors.error, marginBottom: spacing.sm }}>비밀번호가 틀렸습니다</div>}
          <button onClick={handleLogin} style={{
            width: '100%', padding: `${spacing.md}px`, borderRadius: radius.md,
            background: colors.accent, color: colors.bg, fontWeight: typography.bold, fontSize: typography.base,
            border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily,
          }}>로그인</button>
        </div>
      </div>
    )
  }

  const connectedPlayers = gameState
    ? Object.values(gameState.teams).reduce((sum, t) => sum + Object.keys(t.members).length, 0)
    : 0
  const totalPledges = gameState ? Object.keys(gameState.pledges).length : 0
  const roundTeams = activeRound === 1 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]
  const selectedTeamMsgs = chatMessages[selectedChatTeam] || []
  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0)
  const isStarted = !!gameState?.masterStartTime
  const isTestMode = !!gameState?.testMode

  // Current period display
  function getCurrentPeriodLabel(): string {
    if (!gameState?.masterStartTime) return '대기 중'
    // Check first team of each group to determine period
    const gajoInfo = getTeamStageInfo(1)
    const najoInfo = getTeamStageInfo(6)
    if (gajoInfo.stage === 'finished' && najoInfo.stage === 'finished') return '게임 종료'
    const parts: string[] = []
    if (gajoInfo.stage !== 'idle' && gajoInfo.stage !== 'finished') parts.push(`가조: ${gajoInfo.stage}`)
    if (najoInfo.stage !== 'idle' && najoInfo.stage !== 'finished') parts.push(`나조: ${najoInfo.stage}`)
    return parts.join(' / ') || '진행 중'
  }

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily }}>
      {/* ===== Header ===== */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: colors.bg,
        borderBottom: `1px solid ${colors.borderLight}`, padding: `${spacing.sm}px ${spacing.lg}px`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: typography.lg, fontWeight: typography.bold, margin: 0 }}>🎼 V3 관리자</h1>
            <div style={{ fontSize: typography.xs, color: colors.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: isConnected ? colors.accent : colors.error }} />
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
              <span>👥 {connectedPlayers}명</span>
              <span>📜 서약 {totalPledges}명</span>
              <span style={{ color: colors.warning }}>{getCurrentPeriodLabel()}</span>
              {totalUnread > 0 && (
                <span style={{ background: colors.error, color: colors.textPrimary, borderRadius: radius.sm, padding: '1px 6px', fontSize: typography.xs, fontWeight: typography.bold }}>
                  💬 {totalUnread}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            {/* Test Mode Toggle */}
            <button onClick={toggleTestMode} style={{
              padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.md, fontSize: typography.xs,
              background: isTestMode ? colors.warningBg : colors.borderLight,
              border: `1px solid ${isTestMode ? colors.warningBorder : colors.border}`,
              color: isTestMode ? colors.warning : colors.textMuted, cursor: 'pointer', fontFamily: typography.fontFamily,
            }}>
              {isTestMode ? '🧪 테스트' : '실전'}
            </button>
            {/* Master Start */}
            {!isStarted && (
              <button onClick={masterStart} style={{
                padding: `${spacing.xs}px ${spacing.lg}px`, borderRadius: radius.md, fontSize: typography.sm, fontWeight: typography.bold,
                background: colors.accent, color: colors.bg,
                border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily,
              }}>
                ▶ Master Start
              </button>
            )}
            {/* Reset */}
            <button onClick={resetGame} style={{
              padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.md, fontSize: typography.sm,
              background: colors.errorBg, border: `1px solid ${colors.errorBorder}`,
              color: colors.error, cursor: 'pointer', fontFamily: typography.fontFamily,
            }}>초기화</button>
          </div>
        </div>
      </div>

      {/* ===== Round Tabs ===== */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.borderLight}` }}>
        {([1, 2] as const).map(r => (
          <button
            key={r}
            onClick={() => setActiveRound(r)}
            style={{
              flex: 1, padding: spacing.md, fontSize: typography.base, fontWeight: typography.semibold,
              background: activeRound === r ? colors.surfaceLight : 'transparent',
              borderBottom: activeRound === r ? `2px solid ${colors.accent}` : `2px solid transparent`,
              color: activeRound === r ? colors.accent : colors.textMuted,
              border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 2,
              cursor: 'pointer', fontFamily: typography.fontFamily, transition: transitions.normal,
            }}
          >
            {r === 1 ? '🅰 라운드 1 (팀 1-5 · 가조)' : '🅱 라운드 2 (팀 6-10 · 나조)'}
          </button>
        ))}
      </div>

      {/* ===== Map Section ===== */}
      <div style={{ height: '28vh', minHeight: 180, borderBottom: `1px solid ${colors.borderLight}`, position: 'relative' }}>
        <AdminMap gameState={gameState} round={activeRound} />
        <div style={{
          position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: spacing.xs, flexWrap: 'wrap',
          background: 'rgba(10,10,15,0.85)', borderRadius: radius.sm, padding: `5px ${spacing.sm}px`,
        }}>
          {roundTeams.map(tId => (
            <span key={tId} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: typography.xs, color: colors.textSecondary }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TEAM_COLORS[tId], display: 'inline-block' }} />
              {tId}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: `${spacing.sm}px ${spacing.lg}px` }}>
        {/* ===== Team Cards ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.md, marginBottom: 20 }}>
          {roundTeams.map(tId => {
            const team = gameState?.teams[tId]
            const memberCount = team ? Object.keys(team.members).length : 0
            const color = TEAM_COLORS[tId]
            const stageInfo = getTeamStageInfo(tId)
            const currentStage = stageInfo.stage
            const pCount = pledgeCounts[tId] || 0
            const teamUnread = unreadCounts[tId] || 0
            const isS1Complete = !!team?.stage1CompletedAt
            const isS2Complete = !!team?.stage2CompletedAt

            // Badge config
            const badgeConfig: Record<string, { label: string; color: string; bg: string }> = {
              idle: { label: '대기', color: colors.textDisabled, bg: colors.borderLight },
              stage1: { label: 'Stage 1', color: colors.stage1 || '#a855f7', bg: colors.stage1Bg || 'rgba(168,85,247,0.1)' },
              stage2: { label: 'Stage 2', color: colors.stage2 || '#3b82f6', bg: colors.stage2Bg || 'rgba(59,130,246,0.1)' },
              stage3: { label: 'Stage 3', color: colors.warning, bg: colors.warningBg },
              finished: { label: '종료', color: colors.accent, bg: colors.accentMuted },
            }
            const badge = badgeConfig[currentStage] || badgeConfig.idle

            const stageBorderColor = teamUnread > 0 ? colors.infoBorder
              : currentStage === 'stage1' ? (colors.stage1Border || 'rgba(168,85,247,0.2)')
              : currentStage === 'stage2' ? (colors.stage2Border || 'rgba(59,130,246,0.2)')
              : currentStage === 'stage3' ? colors.warningBorder
              : currentStage === 'finished' ? colors.accentBorder
              : colors.borderLight
            const stageBgColor = teamUnread > 0 ? colors.infoBg
              : currentStage === 'stage1' ? (colors.stage1Bg || 'rgba(168,85,247,0.06)')
              : currentStage === 'stage2' ? (colors.stage2Bg || 'rgba(59,130,246,0.06)')
              : currentStage === 'stage3' ? colors.warningBg
              : currentStage === 'finished' ? colors.accentMuted
              : colors.surface

            return (
              <div key={tId} style={{
                padding: `${spacing.md}px`, borderRadius: radius.lg, position: 'relative',
                background: stageBgColor, border: `1px solid ${stageBorderColor}`,
              }}>
                {/* Unread indicator */}
                {teamUnread > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: colors.info, color: colors.textPrimary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: typography.xs, fontWeight: typography.bold,
                    boxShadow: `0 0 8px ${colors.infoBorder}`,
                  }}>{teamUnread}</span>
                )}

                {/* Stage badge + timer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                    <span style={{
                      padding: `2px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.xs, fontWeight: typography.bold,
                      background: badge.bg, color: badge.color, letterSpacing: 0.5,
                      border: `1px solid ${badge.color}30`,
                    }}>{badge.label}</span>
                    {currentStage === 'stage2' && (
                      <span style={{ fontSize: typography.xs, color: colors.textMuted }}>단계 {getStepLabel(tId)}</span>
                    )}
                    {currentStage !== 'stage2' && isS2Complete && (
                      <span style={{ fontSize: typography.xs, color: colors.accent }}>S2 {getStepLabel(tId)}</span>
                    )}
                  </div>
                  {currentStage !== 'idle' && currentStage !== 'finished' && (
                    <span style={{
                      fontFamily: 'monospace', fontSize: typography.md, fontWeight: typography.semibold,
                      color: badge.color,
                    }}>
                      {formatTime(stageInfo.remaining)}
                    </span>
                  )}
                </div>

                {/* Team header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${color}20`, color, fontFamily: 'monospace', fontSize: typography.base, fontWeight: typography.bold,
                    }}>{tId}</span>
                    <div>
                      <div style={{ fontSize: typography.md, fontWeight: typography.semibold, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        {getTeamLabel(tId)}
                        {teamUnread > 0 && (
                          <span style={{
                            background: colors.info, color: colors.textPrimary, borderRadius: radius.md, padding: '1px 7px',
                            fontSize: typography.xs, fontWeight: typography.bold,
                          }}>💬 {teamUnread}</span>
                        )}
                      </div>
                      <div style={{ fontSize: typography.xs, color: colors.textMuted, display: 'flex', gap: spacing.sm }}>
                        <span>👥 {memberCount}명</span>
                        <span>📜 {pCount}명</span>
                        <span>{team?.group || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage progress bar */}
                <div style={{ display: 'flex', gap: 3, marginBottom: spacing.sm }}>
                  {/* The 3 stages in this team's sequence */}
                  {['stage1', 'stage2', 'stage3'].map((s, _idx) => {
                    const isCurrent = currentStage === s
                    const isPast = currentStage === 'finished' ||
                      (s === 'stage1' && (currentStage === 'stage2' || currentStage === 'stage3')) ||
                      (s === 'stage2' && currentStage === 'stage3')
                    // For stage2, show step progress
                    if (s === 'stage2') {
                      return [1, 2, 3].map(step => {
                        const completed = team?.completedSteps.includes(step)
                        const isCurStep = currentStage === 'stage2' && team?.currentStep === step
                        return (
                          <div key={`s2-${step}`} style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: completed ? (colors.stage2 || '#3b82f6')
                              : isCurStep ? (colors.stage2Border || 'rgba(59,130,246,0.4)')
                              : isPast ? (colors.stage2 || '#3b82f6')
                              : colors.borderLight,
                            transition: transitions.normal,
                          }} />
                        )
                      })
                    }
                    return (
                      <div key={s} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: isPast ? (s === 'stage1' ? (colors.stage1 || '#a855f7') : colors.warning)
                          : isCurrent ? (s === 'stage1' ? (colors.stage1 || '#a855f7') : colors.warning)
                          : colors.borderLight,
                        opacity: isCurrent ? 1 : isPast ? 0.7 : 0.3,
                        transition: transitions.normal,
                      }} />
                    )
                  })}
                </div>

                {/* Stage 1 completion status */}
                {currentStage === 'stage1' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <span style={{ fontSize: typography.xs, color: isS1Complete ? colors.accent : colors.textMuted }}>
                      {isS1Complete ? `✅ 미션 완료 (${getS1ElapsedLabel(tId) || ''})` : '미션 진행 중'}
                    </span>
                    {!isS1Complete && (
                      <button onClick={() => recordStage1Complete(tId)} style={{
                        padding: `2px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.xs,
                        background: colors.accentMuted, border: `1px solid ${colors.accentBorder}`,
                        color: colors.accent, cursor: 'pointer', fontFamily: typography.fontFamily,
                      }}>완료 기록</button>
                    )}
                  </div>
                )}
                {currentStage !== 'stage1' && isS1Complete && (
                  <div style={{ marginBottom: spacing.xs }}>
                    <span style={{ fontSize: typography.xs, color: colors.accent }}>S1 완료 ({getS1ElapsedLabel(tId) || ''})</span>
                  </div>
                )}

                {/* Stage 2 history */}
                {currentStage === 'stage2' && team?.stage2History && team.stage2History.length > 0 && (
                  <div style={{ fontSize: typography.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
                    시도: {team.stage2History.map((h, i) => (
                      <span key={i} style={{ color: h.isCorrect ? colors.accent : colors.error, marginRight: 3 }}>
                        {h.isCorrect ? '✓' : '✗'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stage 2 수동 해금 버튼 */}
                {currentStage === 'stage2' && !isS2Complete && team?.currentStep >= 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <span style={{ fontSize: typography.xs, color: colors.textMuted }}>
                      {team.currentStep}단계 진행 중
                    </span>
                    <button onClick={() => forceAdvanceStep(tId)} style={{
                      padding: `2px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.xs,
                      background: colors.infoBg || 'rgba(59,130,246,0.1)', border: `1px solid ${colors.infoBorder || 'rgba(59,130,246,0.3)'}`,
                      color: colors.info || '#3b82f6', cursor: 'pointer', fontFamily: typography.fontFamily,
                    }}>🔓 수동 해금</button>
                  </div>
                )}

                {/* Stage 2 complete status */}
                {isS2Complete && (
                  <div style={{ fontSize: typography.xs, color: colors.accent, marginBottom: spacing.xs }}>
                    ✅ Stage 2 미션 완료
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs }}>
                  {/* Skip Stage (test mode or emergency) */}
                  {currentStage !== 'idle' && currentStage !== 'finished' && (
                    <button onClick={() => skipStage(tId)} style={{
                      padding: `2px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.xs,
                      background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
                      color: colors.warning, cursor: 'pointer', fontFamily: typography.fontFamily,
                    }}>Skip →</button>
                  )}
                  <button onClick={() => resetTeam(tId)} style={{
                    padding: `2px ${spacing.sm}px`, borderRadius: radius.sm, fontSize: typography.xs,
                    background: colors.errorBg, border: `1px solid ${colors.errorBorder}`,
                    color: colors.error, cursor: 'pointer', fontFamily: typography.fontFamily,
                  }}>리셋</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ===== Chat Section ===== */}
        <div style={{
          background: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
          border: `1px solid ${colors.borderLight}`, marginBottom: spacing.xl,
        }}>
          <h3 style={{ fontSize: typography.md, fontWeight: typography.semibold, marginBottom: spacing.md, color: colors.accent }}>💬 팀 채팅</h3>

          {/* Team selector */}
          <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.md, overflowX: 'auto', paddingBottom: spacing.xs }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(t => {
              const tUnread = unreadCounts[t] || 0
              return (
                <button key={t} onClick={() => setSelectedChatTeam(t)} style={{
                  padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.md, fontSize: typography.xs,
                  background: selectedChatTeam === t ? colors.accent : (tUnread > 0 ? colors.infoBg : colors.borderLight),
                  color: selectedChatTeam === t ? colors.bg : (tUnread > 0 ? colors.info : colors.textMuted),
                  border: tUnread > 0 ? `1px solid ${colors.infoBorder}` : `1px solid ${colors.border}`,
                  cursor: 'pointer', fontFamily: typography.fontFamily, whiteSpace: 'nowrap',
                  fontWeight: tUnread > 0 ? typography.bold : typography.semibold,
                  position: 'relative',
                }}>
                  {getTeamName(t)}
                  {tUnread > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 16, height: 16, borderRadius: '50%',
                      background: colors.info, color: colors.textPrimary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: typography.bold,
                    }}>{tUnread}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Messages */}
          <div style={{
            height: 200, overflowY: 'auto', background: colors.bg, borderRadius: radius.md,
            padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.borderLight}`,
          }}>
            {selectedTeamMsgs.length === 0 && (
              <div style={{ textAlign: 'center', color: colors.textDisabled, fontSize: typography.sm, marginTop: spacing.xl }}>
                채팅 내역이 없습니다
              </div>
            )}
            {selectedTeamMsgs.map((msg, i) => (
              <div key={msg.id || i} style={{
                marginBottom: spacing.sm, display: 'flex', flexDirection: 'column',
                alignItems: msg.isAdmin ? 'flex-end' : 'flex-start',
              }}>
                <div style={{ fontSize: typography.xs, color: colors.textDisabled, marginBottom: 2 }}>
                  {msg.isAdmin ? '관리자' : msg.senderName}
                </div>
                <div style={{
                  padding: '6px 10px', borderRadius: radius.md, maxWidth: '80%',
                  background: msg.isAdmin ? colors.accentMuted : colors.borderLight,
                  fontSize: typography.sm, lineHeight: 1.4,
                }}>{msg.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: spacing.xs }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChat() }}
              placeholder={`${getTeamName(selectedChatTeam)}에게 메시지...`}
              style={{
                flex: 1, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                background: colors.borderLight, border: `1px solid ${colors.border}`,
                color: colors.textPrimary, fontSize: typography.sm, outline: 'none',
                fontFamily: typography.fontFamily,
              }}
            />
            <button onClick={sendChat} style={{
              padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.md,
              background: chatInput.trim() ? colors.accent : colors.borderLight,
              color: chatInput.trim() ? colors.bg : colors.textDisabled,
              border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
              fontSize: typography.sm, fontWeight: typography.semibold, fontFamily: typography.fontFamily,
            }}>전송</button>
          </div>
        </div>
      </div>
    </div>
  )
}
