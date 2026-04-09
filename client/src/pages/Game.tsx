import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGPS } from '../hooks/useGPS'
import { useSocket } from '../hooks/useSocket'
import { MapView } from '../components/MapView'
import { HintCard } from '../components/HintCard'
import {
  getLocationById,
  calculateDistance,
  getDirectionBearing,
  getTeamName,
} from '../data/gameData'
import type { Location, PlayerPosition, ChatMessage, TeamStage } from '../../../shared/types'
import { colors, typography, spacing, radius, shadows, transitions } from '../theme'

const DIRECTION_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const

function bearingToArrow(bearing: number): string {
  const idx = Math.round(bearing / 45) % 8
  return DIRECTION_ARROWS[idx]
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

interface StepLocations {
  correctId: string
  wrongId: string
}

export function Game() {
  const navigate = useNavigate()
  const { position, error: gpsError } = useGPS()
  const { socket, isConnected } = useSocket()

  // Login info from localStorage
  const [teamId] = useState(() => parseInt(localStorage.getItem('teamId') || '0', 10))
  const [playerId] = useState(() => localStorage.getItem('playerId') || '')
  const [playerName] = useState(() => localStorage.getItem('playerName') || '')
  const [teamPassword] = useState(() => localStorage.getItem('teamPassword') || '')
  const [isRepresentative] = useState(() => localStorage.getItem('isRepresentative') === 'true')

  // Stage state
  const [stage, setStage] = useState<TeamStage>('idle')

  // Stage 1 timer state
  const [s1TimerActive, setS1TimerActive] = useState(false)
  const [s1TimerPaused, setS1TimerPaused] = useState(false)
  const [s1TimerExpired, setS1TimerExpired] = useState(false)
  const [s1TimerStartTime, setS1TimerStartTime] = useState<number | null>(null)
  const [s1TimerDuration, setS1TimerDuration] = useState(40 * 60 * 1000)
  const [s1TimerDisplay, setS1TimerDisplay] = useState('40:00')

  // Stage 2 game state
  const [currentStep, setCurrentStep] = useState(0)
  const [hint, setHint] = useState('')
  const [stepLocations, setStepLocations] = useState<StepLocations | null>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [isTimerPaused, setIsTimerPaused] = useState(false)
  const [isTimerExpired, setIsTimerExpired] = useState(false)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [timerDuration, setTimerDuration] = useState(25 * 60 * 1000)
  const [timerDisplay, setTimerDisplay] = useState('25:00')
  const [teamMembers, setTeamMembers] = useState<PlayerPosition[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, { count: number; needed: number }>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  // Overlays
  const [showStepComplete, setShowStepComplete] = useState<{ stepNumber: number; photo: string } | null>(null)
  const [showWrong, setShowWrong] = useState<{ locationId: string; photo: string } | null>(null)
  const [showComplete, setShowComplete] = useState<{ photo: string } | null>(null)
  const [showTimeoutOverlay, setShowTimeoutOverlay] = useState(true)
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(true)

  // Chat (representative only)
  const [chatOpen, setChatOpen] = useState(false)
  const chatOpenRef = useRef(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!teamId || !playerId) navigate('/')
  }, [teamId, playerId, navigate])

  // Join team (once)
  useEffect(() => {
    if (!socket || !teamId || joined) return

    const joinTeam = () => {
      socket.emit('player:join', {
        teamId, playerId, playerName,
        password: teamPassword, isRepresentative,
      })
      setJoined(true)
    }

    if (isConnected) joinTeam()
    socket.on('connect', joinTeam)

    return () => {
      socket.off('connect', joinTeam)
    }
  }, [socket, isConnected, teamId, playerId, playerName, teamPassword, isRepresentative, joined])

  // Listen for all game events (always active)
  useEffect(() => {
    if (!socket || !teamId) return

    // Game state
    socket.on('game:state', (state) => {
      const team = state.teams[teamId]
      if (team) {
        // Stage
        setStage(team.stage || 'idle')
        // Stage 1 timer
        setS1TimerActive(team.stage1TimerActive || false)
        setS1TimerPaused(team.stage1TimerPaused || false)
        setS1TimerExpired(team.stage1TimerExpired || false)
        if (team.stage1TimerStartTime) {
          setS1TimerStartTime(team.stage1TimerStartTime)
          setS1TimerDuration(team.stage1TimerDuration)
        }
        // Stage 2
        setCurrentStep(team.currentStep)
        setCompletedSteps(team.completedSteps)
        setIsComplete(team.isComplete)
        setIsTimerActive(team.isTimerActive)
        setIsTimerPaused(team.isTimerPaused || false)
        setIsTimerExpired(team.isTimerExpired)
        if (team.timerStartTime) {
          setTimerStartTime(team.timerStartTime)
          setTimerDuration(team.timerDuration)
        }
      }
    })

    // Stage update (new step hint + locations)
    socket.on('team:stageUpdate', (data) => {
      if (data.teamId === teamId) {
        setCurrentStep(data.currentStep)
        setHint(data.hint)
        setStepLocations(data.locations)
        setShowWrong(null)
      }
    })

    // Step complete
    socket.on('team:stepComplete', (data) => {
      if (data.teamId === teamId) {
        setCompletedSteps(prev => [...prev, data.stepNumber])
        setShowStepComplete({ stepNumber: data.stepNumber, photo: data.photo })
        setShowWrong(null)
      }
    })

    // Wrong location
    socket.on('team:wrong', (data) => {
      if (data.teamId === teamId) {
        setShowWrong({ locationId: data.locationId, photo: data.photo })
      }
    })

    // All steps complete
    socket.on('team:complete', (data) => {
      if (data.teamId === teamId) {
        setIsComplete(true)
        setShowComplete({ photo: data.photo })
        setShowCompleteOverlay(true)
        setShowStepComplete(null)
      }
    })

    // Timer events
    socket.on('team:timerStart', (data) => {
      if (data.teamId === teamId) {
        setIsTimerActive(true)
        setTimerStartTime(Date.now())
        setTimerDuration(data.duration)
        setIsTimerExpired(false)
      }
    })

    // Stage change
    socket.on('team:stageChange', (data) => {
      if (data.teamId === teamId) {
        setStage(data.stage)
      }
    })

    // Stage 1 timer events
    socket.on('team:stage1TimerStart', (data) => {
      if (data.teamId === teamId) {
        setS1TimerActive(true)
        setS1TimerPaused(false)
        setS1TimerExpired(false)
        setS1TimerStartTime(Date.now())
        setS1TimerDuration(data.duration)
      }
    })

    socket.on('team:stage1TimerPaused', (data) => {
      if (data.teamId === teamId) {
        setS1TimerActive(false)
        setS1TimerPaused(true)
        const remaining = data.remaining
        const mins = Math.floor(remaining / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        setS1TimerDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
    })

    socket.on('team:stage1TimerResumed', (data) => {
      if (data.teamId === teamId) {
        setS1TimerActive(true)
        setS1TimerPaused(false)
        setS1TimerStartTime(Date.now())
        setS1TimerDuration(data.duration)
      }
    })

    socket.on('team:stage1TimerExpired', (data) => {
      if (data.teamId === teamId) {
        setS1TimerActive(false)
        setS1TimerPaused(false)
        setS1TimerExpired(true)
      }
    })

    // Stage 2 timer events
    socket.on('team:timerPaused', (data) => {
      if (data.teamId === teamId) {
        setIsTimerActive(false)
        setIsTimerPaused(true)
        // Show remaining time frozen
        const remaining = data.remaining
        const mins = Math.floor(remaining / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        setTimerDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
    })

    socket.on('team:timerResumed', (data) => {
      if (data.teamId === teamId) {
        setIsTimerActive(true)
        setIsTimerPaused(false)
        setTimerStartTime(Date.now())
        setTimerDuration(data.duration)
      }
    })

    socket.on('team:timerExpired', (data) => {
      if (data.teamId === teamId) {
        setIsTimerActive(false)
        setIsTimerPaused(false)
        setIsTimerExpired(true)
        setShowTimeoutOverlay(true)
      }
    })

    // Team positions
    socket.on('team:positions', (positions) => {
      setTeamMembers(positions.filter((p: PlayerPosition) => p.playerId !== playerId))
    })

    // Member count at locations
    socket.on('team:memberCount', (data) => {
      setMemberCounts(prev => ({
        ...prev,
        [data.locationId]: { count: data.count, needed: data.needed },
      }))
    })

    // Chat messages (for representative)
    socket.on('chat:message', (msg: ChatMessage) => {
      if (msg.teamId === teamId) {
        setChatMessages(prev => [...prev, msg])
        // Increment unread only if chat is closed and message is from admin
        if (msg.isAdmin && !chatOpenRef.current) {
          setUnreadCount(prev => prev + 1)
        }
      }
    })

    socket.on('chat:history', (msgs: ChatMessage[]) => {
      if (msgs.length > 0 && msgs[0].teamId === teamId) {
        setChatMessages(msgs)
      }
    })

    // Error
    socket.on('error', (data) => {
      setErrorMsg(data.message)
      setTimeout(() => setErrorMsg(null), 4000)
    })

    return () => {
      socket.off('game:state')
      socket.off('team:stageUpdate')
      socket.off('team:stepComplete')
      socket.off('team:wrong')
      socket.off('team:complete')
      socket.off('team:stageChange')
      socket.off('team:stage1TimerStart')
      socket.off('team:stage1TimerPaused')
      socket.off('team:stage1TimerResumed')
      socket.off('team:stage1TimerExpired')
      socket.off('team:timerStart')
      socket.off('team:timerPaused')
      socket.off('team:timerResumed')
      socket.off('team:timerExpired')
      socket.off('team:positions')
      socket.off('team:memberCount')
      socket.off('chat:message')
      socket.off('chat:history')
      socket.off('error')
    }
  }, [socket, teamId, playerId, navigate])

  // Send GPS position to server (throttled to 1/sec max)
  useEffect(() => {
    if (!socket || !position || !teamId) return
    const timer = setTimeout(() => {
      socket.emit('player:position', {
        playerId, teamId,
        lat: position.lat, lng: position.lng,
        timestamp: Date.now(),
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [socket, position, teamId, playerId])

  // Timer display
  useEffect(() => {
    // When paused, timer display is already set by the timerPaused handler
    if (isTimerPaused) return
    if (!isTimerActive || !timerStartTime) {
      if (!isTimerActive && !isTimerExpired && !isTimerPaused) setTimerDisplay('25:00')
      return
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStartTime
      const remaining = Math.max(0, timerDuration - elapsed)
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setTimerDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerActive, isTimerPaused, timerStartTime, timerDuration, isTimerExpired])

  // Stage 1 timer display
  useEffect(() => {
    if (s1TimerPaused) return
    if (!s1TimerActive || !s1TimerStartTime) {
      if (!s1TimerActive && !s1TimerExpired && !s1TimerPaused) setS1TimerDisplay('40:00')
      return
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - s1TimerStartTime
      const remaining = Math.max(0, s1TimerDuration - elapsed)
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setS1TimerDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [s1TimerActive, s1TimerPaused, s1TimerStartTime, s1TimerDuration, s1TimerExpired])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Sync ref and clear unread when chat opens
  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) setUnreadCount(0)
  }, [chatOpen])

  // Send chat message
  const sendChatMessage = useCallback(() => {
    if (!socket || !chatInput.trim()) return
    socket.emit('chat:send', { teamId, message: chatInput.trim() })
    setChatInput('')
  }, [socket, teamId, chatInput])

  // Check location handler
  const handleCheckLocation = useCallback((locationId: string) => {
    if (!socket || isComplete || !isTimerActive || isTimerPaused) return
    socket.emit('player:checkLocation', { locationId })
  }, [socket, isComplete, isTimerActive, isTimerPaused])

  // Get visible locations for map
  const visibleLocations: Location[] = []
  if (stepLocations) {
    const loc1 = getLocationById(stepLocations.correctId)
    const loc2 = getLocationById(stepLocations.wrongId)
    if (loc1) visibleLocations.push(loc1)
    if (loc2) visibleLocations.push(loc2)
  }

  // Location info helper
  function getLocationInfo(loc: Location) {
    if (!position) return { distance: null, arrow: '', status: 'unknown' as const }
    const dist = calculateDistance(position.lat, position.lng, loc.lat, loc.lng)
    const bearing = getDirectionBearing(position.lat, position.lng, loc.lat, loc.lng)
    const arrow = bearingToArrow(bearing)
    let status: 'inside' | 'approaching' | 'outside' = 'outside'
    if (dist <= loc.unlockRadius) status = 'inside'
    else if (dist <= loc.approachRadius) status = 'approaching'
    return { distance: dist, arrow, status }
  }

  // ========== Stage 1 / Stage 1 Ready / Idle Rendering ==========
  if (stage === 'idle' || stage === 'stage1_ready' || stage === 'stage1' || stage === 'stage2_ready') {
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: colors.bg, borderBottom: `1px solid ${colors.borderLight}`, padding: `${spacing.md}px ${spacing.lg}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <span style={{ fontSize: typography.sm, color: colors.accent }}>{getTeamName(teamId)}</span>
              <span style={{
                width: 6, height: 6, borderRadius: radius.full,
                background: isConnected ? colors.accent : colors.error,
                display: 'inline-block',
              }} />
            </div>
            <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>
              {stage === 'idle' ? '대기 중' : stage === 'stage1_ready' ? 'Stage 1 준비' : stage === 'stage2_ready' ? 'Stage 2 준비' : 'Stage 1'}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          {stage === 'idle' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: spacing.xl }}>🎼</div>
              <h2 style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: spacing.md }}>신의 악단</h2>
              <p style={{ fontSize: typography.base, color: colors.textSecondary }}>관리자가 게임을 시작할 때까지 대기해주세요</p>
            </div>
          )}

          {stage === 'stage1_ready' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: spacing.xl }}>🔐</div>
              <h2 style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.warning, marginBottom: spacing.md }}>Stage 1 준비</h2>
              <p style={{ fontSize: typography.base, color: colors.textMuted }}>곧 시작됩니다. 준비해주세요!</p>
              <div style={{
                marginTop: spacing.xl, fontSize: typography.timer, fontWeight: typography.bold,
                color: colors.warningBg, fontVariantNumeric: 'tabular-nums',
                fontFamily: typography.monoFamily,
              }}>
                40:00
              </div>
            </div>
          )}

          {stage === 'stage1' && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              {/* Timer icon */}
              <div style={{ fontSize: 36, marginBottom: spacing.lg }}>
                {s1TimerExpired ? '⏰' : s1TimerPaused ? '⏸️' : '🔐'}
              </div>

              {/* Stage label */}
              <div style={{ fontSize: typography.sm, color: colors.textMuted, letterSpacing: typography.label, textTransform: 'uppercase', marginBottom: spacing.md }}>
                Stage 1
              </div>

              {/* Big timer */}
              <div style={{
                fontSize: typography.timer, fontWeight: typography.bold, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', fontFamily: typography.monoFamily,
                color: s1TimerExpired ? colors.error : s1TimerPaused ? colors.warning : colors.textPrimary,
                marginBottom: spacing.lg,
                animation: s1TimerPaused ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}>
                {s1TimerDisplay}
              </div>

              {/* Status text */}
              <div style={{ fontSize: typography.base, color: colors.textSecondary }}>
                {s1TimerExpired ? '시간이 종료되었습니다' : s1TimerPaused ? '일시정지됨' : s1TimerActive ? '진행 중...' : '대기 중'}
              </div>
            </div>
          )}

          {stage === 'stage2_ready' && (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 48, marginBottom: spacing.lg }}>🗺️</div>
              <h2 style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.stage2, marginBottom: spacing.sm }}>Stage 2 준비</h2>
              <p style={{ fontSize: typography.base, color: colors.textMuted, marginBottom: spacing.xl }}>곧 시작됩니다. 규칙을 확인하세요!</p>

              {/* Game Rules */}
              <div style={{
                background: colors.surface, border: `1px solid ${colors.borderLight}`,
                borderRadius: radius.lg, padding: spacing.lg, textAlign: 'left',
                marginBottom: spacing.xl,
              }}>
                {[
                  { icon: '📍', title: '장소 찾기', desc: '힌트를 읽고 3개의 장소를 순서대로 찾아가세요. 각 단계마다 2곳 중 정답 장소를 골라야 합니다.' },
                  { icon: '⏱', title: '제한 시간', desc: '25분 안에 3개의 장소를 모두 찾으면 악보 조각을 획득합니다.' },
                  { icon: '👥', title: '팀 협동', desc: '팀원 3명 이상이 정답 장소 근처(50m)에 모여야 해금됩니다. 함께 움직이세요!' },
                ].map((rule, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: spacing.md, alignItems: 'flex-start',
                    marginBottom: i < 2 ? spacing.lg : 0,
                  }}>
                    <span style={{ fontSize: 18, marginTop: 2 }}>{rule.icon}</span>
                    <div>
                      <div style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: spacing.xs }}>
                        {rule.title}
                      </div>
                      <div style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                        {rule.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                fontSize: typography.timer, fontWeight: typography.bold,
                color: colors.stage2Bg, fontVariantNumeric: 'tabular-nums',
                fontFamily: typography.monoFamily,
              }}>
                25:00
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
            background: colors.error, color: colors.textPrimary, padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radius.md, fontSize: typography.sm, zIndex: 100,
          }}>
            {errorMsg}
          </div>
        )}

        {/* Chat (always available for representative) */}
        {isRepresentative && (
          <div style={{ position: 'fixed', bottom: spacing.lg, right: spacing.lg, zIndex: 110 }}>
            {!chatOpen && (
              <button
                onClick={() => setChatOpen(true)}
                style={{
                  width: 52, height: 52, borderRadius: radius.full,
                  background: colors.accent, color: colors.bg,
                  border: 'none', cursor: 'pointer',
                  fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: shadows.accent, position: 'relative',
                }}>
                💬
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: colors.error, color: colors.textPrimary, borderRadius: radius.full,
                    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: typography.xs, fontWeight: typography.bold,
                  }}>{unreadCount}</span>
                )}
              </button>
            )}
            {chatOpen && (
              <div style={{
                width: 300, height: 400, borderRadius: radius.xl,
                background: colors.bg, border: `1px solid ${colors.accentBorder}`,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: shadows.lg,
              }}>
                <div style={{
                  padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.borderLight}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.accent }}>관리자 채팅</span>
                  <button onClick={() => setChatOpen(false)} style={{
                    background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: 16,
                  }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: spacing.md }}>
                  {chatMessages.map((msg, i) => (
                    <div key={msg.id || i} style={{
                      marginBottom: spacing.sm, display: 'flex', flexDirection: 'column',
                      alignItems: msg.isAdmin ? 'flex-start' : 'flex-end',
                    }}>
                      <div style={{ fontSize: typography.xs, color: colors.textDisabled, marginBottom: 2 }}>
                        {msg.isAdmin ? '관리자' : msg.senderName}
                      </div>
                      <div style={{
                        padding: '7px 11px', borderRadius: radius.md, maxWidth: '80%',
                        background: msg.isAdmin ? colors.accentMuted : colors.borderLight,
                        fontSize: typography.sm, lineHeight: 1.4,
                      }}>{msg.message}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: spacing.sm, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', gap: spacing.xs }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChatMessage() }}
                    placeholder="메시지 입력..."
                    style={{
                      flex: 1, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                      background: colors.borderLight, border: `1px solid ${colors.border}`,
                      color: colors.textPrimary, fontSize: typography.sm, outline: 'none',
                      fontFamily: typography.fontFamily,
                    }}
                  />
                  <button onClick={sendChatMessage} style={{
                    padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                    background: chatInput.trim() ? colors.accent : colors.borderLight,
                    color: chatInput.trim() ? colors.bg : colors.textDisabled,
                    border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
                    fontSize: typography.sm, fontWeight: typography.semibold, fontFamily: typography.fontFamily,
                  }}>전송</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ========== Stage 2 (existing game view) ==========
  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: colors.bg, borderBottom: `1px solid ${colors.borderLight}`, padding: `${spacing.md}px ${spacing.lg}px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <span style={{ fontSize: typography.sm, color: colors.accent }}>{getTeamName(teamId)}</span>
            <span style={{
              width: 6, height: 6, borderRadius: radius.full,
              background: isConnected ? colors.accent : colors.error,
              display: 'inline-block',
            }} />
          </div>
          <span style={{
            fontSize: typography.sm, color: colors.warning, fontVariantNumeric: 'tabular-nums',
            background: isTimerPaused ? colors.warningBg : colors.warningBorder,
            padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.sm,
            animation: isTimerPaused ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}>
            {isTimerPaused ? '⏸' : '⏱'} {timerDisplay}
          </span>
        </div>
      </div>

      {/* GPS error */}
      {gpsError && (
        <div style={{ background: colors.errorBg, borderBottom: `1px solid ${colors.errorBorder}`, padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: typography.sm, color: colors.error }}>
          {gpsError}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div style={{ background: colors.warningBg, borderBottom: `1px solid ${colors.warningBorder}`, padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: typography.sm, color: colors.warning }}>
          {errorMsg}
        </div>
      )}

      {/* Waiting state */}
      {currentStep === 0 && !isTimerExpired && (
        <div style={{ background: colors.borderLight, padding: `${spacing.xxxl}px ${spacing.lg}px`, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg }}>⏳</div>
          <div style={{ fontSize: typography.md, fontWeight: typography.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>
            관리자가 타이머를 시작하면
          </div>
          <div style={{ fontSize: typography.base, color: colors.textMuted }}>
            게임이 시작됩니다
          </div>
        </div>
      )}

      {/* Timer expired overlay */}
      {isTimerExpired && !isComplete && showTimeoutOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: `rgba(0,0,0,0.95)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: spacing.xxxl,
        }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg }}>⏰</div>
          <h2 style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.error, marginBottom: spacing.md }}>시간 초과</h2>
          <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.xl }}>25분이 경과했습니다</p>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 300, marginBottom: spacing.xl }}>
            <div style={{
              height: 8, background: colors.borderLight, borderRadius: radius.sm,
              overflow: 'hidden', marginBottom: spacing.md,
            }}>
              <div style={{
                height: '100%', borderRadius: radius.sm, background: colors.accent,
                width: `${Math.round((completedSteps.length / 3) * 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: typography.sm, color: colors.textMuted, textAlign: 'center' }}>
              3단계 중 {completedSteps.length}단계까지 완료
            </div>
          </div>

          {/* CCC Center notice */}
          <div style={{
            background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
            borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl,
            width: '100%', maxWidth: 300,
          }}>
            <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold, marginBottom: spacing.xs }}>
              📍 CCC 센터로 오세요!
            </div>
            <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
              시간이 종료되었습니다<br />센터로 돌아와 주세요
            </div>
          </div>

          <button
            onClick={() => setShowTimeoutOverlay(false)}
            style={{
              padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base,
              background: 'transparent', border: `1px solid ${colors.border}`,
              color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily,
              maxWidth: 300, width: '100%',
              transition: transitions.normal,
            }}
          >
            확인
          </button>
        </div>
      )}

      {/* Waiting state when timer expired (after dismissing overlay) */}
      {isTimerExpired && !isComplete && !showTimeoutOverlay && (
        <div style={{ padding: `${spacing.xxxl}px ${spacing.lg}px`, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg, opacity: 0.6 }}>⏰</div>
          <div style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>
            임무 종료
          </div>
          <div style={{ fontSize: typography.sm, color: colors.textMuted, lineHeight: 1.6, marginBottom: spacing.xxxl }}>
            시간이 종료되었습니다<br />관리자의 안내를 기다려주세요
          </div>
          <div style={{
            background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
            borderRadius: radius.lg, padding: spacing.lg, maxWidth: 280, margin: '0 auto',
          }}>
            <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold }}>
              📍 CCC 센터로 오세요!
            </div>
          </div>
        </div>
      )}

      {/* Game active content */}
      {currentStep > 0 && currentStep <= 3 && !isTimerExpired && (
        <>
          {/* Stage indicator dots */}
          <div style={{ textAlign: 'center', margin: `${spacing.lg}px 0` }}>
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md }}>
              {[1, 2, 3].map(step => {
                const isCompleted = completedSteps.includes(step)
                const isCurrent = step === currentStep && !isComplete
                return (
                  <div key={step} style={{
                    width: 10, height: 10, borderRadius: radius.full,
                    background: isCompleted ? colors.accent : isCurrent ? colors.warning : colors.border,
                    boxShadow: isCurrent ? `0 0 8px ${colors.warningBorder}` : 'none',
                    transition: transitions.normal,
                  }} />
                )
              })}
            </div>
            <div style={{ fontSize: typography.sm, color: colors.textMuted }}>{currentStep}단계 / 3단계</div>
          </div>

          {/* Map */}
          <div style={{ width: '100%', height: '32vh', minHeight: 180 }}>
            <MapView
              locations={visibleLocations}
              playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
              teamMemberPositions={teamMembers.filter(m => m.lat !== 0 && m.lng !== 0).map(m => ({ lat: m.lat, lng: m.lng }))}
              onLocationSelect={handleCheckLocation}
            />
          </div>

          {/* Hint */}
          <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>
            <HintCard hint={hint} />
          </div>

          {/* Location cards - horizontal */}
          <div style={{ padding: `0 ${spacing.lg}px` }}>
            <div style={{ fontSize: typography.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md }}>
              후보 장소를 선택하여 이동하세요
            </div>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
              {visibleLocations.map(loc => {
                const info = getLocationInfo(loc)
                const isWrongGuess = showWrong?.locationId === loc.id

                return (
                  <button
                    key={loc.id}
                    onClick={() => handleCheckLocation(loc.id)}
                    disabled={isComplete || !isTimerActive || isTimerPaused}
                    style={{
                      flex: 1, textAlign: 'center', padding: spacing.lg,
                      borderRadius: radius.md,
                      background: isWrongGuess
                        ? colors.errorBg
                        : info.status === 'inside'
                        ? colors.accentMuted
                        : colors.borderLight,
                      border: `1px solid ${
                        isWrongGuess ? colors.errorBorder
                        : info.status === 'inside' ? colors.accentBorder
                        : colors.border
                      }`,
                      color: colors.textPrimary, cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      transition: transitions.normal,
                    }}
                  >
                    <div style={{ fontSize: typography.base, fontWeight: typography.semibold, marginBottom: spacing.xs, color: colors.textPrimary }}>{loc.name}</div>
                    <div style={{ fontSize: typography.xs, color: colors.textMuted }}>
                      {info.distance !== null ? `${formatDistance(info.distance)} 거리` : '거리 계산 중'}
                    </div>
                    {info.status === 'inside' && (
                      <div style={{ fontSize: typography.xs, color: colors.accent, marginTop: spacing.xs }}>도착!</div>
                    )}
                    {info.status === 'approaching' && (
                      <div style={{ fontSize: typography.xs, color: colors.warning, marginTop: spacing.xs }}>접근 중</div>
                    )}
                    {isWrongGuess && (
                      <div style={{ fontSize: typography.xs, color: colors.error, marginTop: spacing.xs }}>오답</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Member count bar */}
          <div style={{ padding: `0 ${spacing.lg}px ${spacing.xl}px` }}>
            {(() => {
              // Find the best member count data from either location
              const counts = visibleLocations
                .map(loc => memberCounts[loc.id])
                .filter(Boolean)
              const best = counts.length > 0
                ? counts.reduce((a, b) => a.count >= b.count ? a : b)
                : null
              const count = best ? best.count : 0
              const needed = best ? best.needed : 3
              const unlocked = count >= needed
              return (
                <div style={{
                  textAlign: 'center', fontSize: typography.sm, color: colors.textMuted,
                  padding: spacing.sm, background: colors.borderLight, borderRadius: radius.md,
                  transition: transitions.normal,
                }}>
                  현재 위치 근처 팀원: <span style={{ color: colors.accent, fontWeight: typography.semibold }}>
                    {count}/{needed}
                  </span>명{unlocked && ' ✅ 해금 가능!'}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* Step Complete Overlay */}
      {showStepComplete && !showComplete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: `rgba(0,0,0,0.95)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: spacing.xxxl,
        }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg }}>🎶</div>
          <h2 style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.accent, marginBottom: spacing.md }}>
            {showStepComplete.stepNumber}단계 통과!
          </h2>
          <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.xl }}>
            다음 장소를 향해 출발하세요
          </p>

          {/* Stage indicator dots */}
          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.xl }}>
            {[1, 2, 3].map(step => {
              const isStepCompleted = completedSteps.includes(step)
              const isCurrent = step === currentStep && !isComplete
              return (
                <div key={step} style={{
                  width: 10, height: 10, borderRadius: radius.full,
                  background: isStepCompleted ? colors.accent : isCurrent ? colors.warning : colors.border,
                  boxShadow: isCurrent ? `0 0 8px ${colors.warningBorder}` : 'none',
                  transition: transitions.normal,
                }} />
              )
            })}
          </div>

          {/* Step photo removed — only final 악보 shown on game completion */}
          <button
            onClick={() => setShowStepComplete(null)}
            style={{
              padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
              background: colors.accent, color: colors.bg, border: 'none', cursor: 'pointer',
              fontFamily: typography.fontFamily,
              maxWidth: 300, width: '100%',
              transition: transitions.normal,
            }}
          >
            다음 단계로
          </button>
        </div>
      )}

      {/* Wrong Location Overlay */}
      {showWrong && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: `rgba(0,0,0,0.95)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: spacing.xxxl,
        }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg }}>❌</div>
          <h2 style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.error, marginBottom: spacing.md }}>이곳이 아닙니다</h2>
          <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.xl }}>다른 장소를 찾아보세요</p>
          {/* Wrong photo removed — only final 악보 shown on game completion */}
          <button
            onClick={() => setShowWrong(null)}
            style={{
              padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
              background: colors.error, color: colors.textPrimary, border: 'none', cursor: 'pointer',
              fontFamily: typography.fontFamily,
              maxWidth: 300, width: '100%',
              transition: transitions.normal,
            }}
          >
            다른 장소로 이동
          </button>
        </div>
      )}

      {/* Game Complete Overlay */}
      {showComplete && showCompleteOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: `rgba(0,0,0,0.95)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: spacing.xxxl,
        }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg }}>🏆</div>
          <h2 style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.warning, marginBottom: spacing.md }}>
            임무 완료!
          </h2>
          <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.xl }}>
            모든 악보 조각을 찾았습니다
          </p>

          {/* Stage indicator dots - all completed */}
          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.xl }}>
            {[1, 2, 3].map(step => (
              <div key={step} style={{
                width: 10, height: 10, borderRadius: radius.full,
                background: colors.accent,
                transition: transitions.normal,
              }} />
            ))}
          </div>

          {showComplete.photo && (
            <div style={{
              width: '100%', maxWidth: 280, aspectRatio: '4/3', borderRadius: radius.lg,
              overflow: 'hidden', marginBottom: spacing.xl,
              border: `1px solid ${colors.warningBorder}`,
            }}>
              <img src={`/${showComplete.photo}`} alt="완성된 악보" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* CCC Center notice */}
          <div style={{
            background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
            borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl,
            width: '100%', maxWidth: 300,
          }}>
            <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold }}>
              📍 CCC 센터로 오세요!
            </div>
          </div>

          <button
            onClick={() => setShowCompleteOverlay(false)}
            style={{
              padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
              background: colors.accent, color: colors.bg, border: 'none', cursor: 'pointer',
              fontFamily: typography.fontFamily,
              maxWidth: 300, width: '100%',
              transition: transitions.normal,
            }}
          >
            확인
          </button>
        </div>
      )}

      {/* Waiting state when game is complete (after dismissing overlay) */}
      {isComplete && !showCompleteOverlay && (
        <div style={{ padding: `${spacing.xxxl}px ${spacing.lg}px`, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: spacing.lg, opacity: 0.6 }}>🏆</div>
          <div style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>
            임무 완료
          </div>
          <div style={{ fontSize: typography.sm, color: colors.textMuted, lineHeight: 1.6, marginBottom: spacing.xxxl }}>
            모든 악보 조각을 찾았습니다<br />관리자의 안내를 기다려주세요
          </div>
          <div style={{
            background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
            borderRadius: radius.lg, padding: spacing.lg, maxWidth: 280, margin: '0 auto',
          }}>
            <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold }}>
              📍 CCC 센터로 오세요!
            </div>
          </div>
        </div>
      )}

      {/* Chat for representative — always visible regardless of game state */}
      {isRepresentative && (
        <>
          {/* Floating chat button */}
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              style={{
                position: 'fixed', bottom: spacing.xl, right: spacing.xl, zIndex: 110,
                width: 50, height: 50, borderRadius: radius.full,
                background: colors.accent, color: colors.bg, border: 'none',
                fontSize: 22, cursor: 'pointer',
                boxShadow: shadows.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: transitions.normal,
              }}
            >
              💬
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: colors.error, color: colors.textPrimary, fontSize: typography.xs, fontWeight: typography.bold,
                  width: 20, height: 20, borderRadius: radius.full,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Chat panel */}
          {chatOpen && (
            <div style={{
              position: 'fixed', bottom: 80, right: spacing.lg, zIndex: 110,
              width: 300, height: 400,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.xl,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: typography.fontFamily,
              boxShadow: shadows.lg,
            }}>
              {/* Chat header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${spacing.md}px ${spacing.lg}px`,
                background: colors.accentMuted,
                borderBottom: `1px solid ${colors.borderLight}`,
              }}>
                <span style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.accent }}>관리자 채팅</span>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    background: 'none', border: 'none', color: colors.textMuted,
                    fontSize: 18, cursor: 'pointer',
                    transition: transitions.normal,
                  }}
                >✕</button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: colors.textDisabled, fontSize: typography.sm, paddingTop: 30 }}>
                    관리자에게 메시지를 보내보세요
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={msg.id || i} style={{
                      maxWidth: '80%', padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                      alignSelf: msg.isAdmin ? 'flex-start' : 'flex-end',
                      background: msg.isAdmin ? colors.borderLight : colors.accentMuted,
                      borderBottomLeftRadius: msg.isAdmin ? radius.sm : radius.md,
                      borderBottomRightRadius: msg.isAdmin ? radius.md : radius.sm,
                      fontSize: typography.sm, lineHeight: 1.4, color: msg.isAdmin ? colors.textSecondary : colors.textPrimary,
                      transition: transitions.normal,
                    }}>
                      <div style={{ fontSize: typography.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
                        {msg.senderName}
                      </div>
                      {msg.message}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: spacing.sm, padding: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
                <input
                  type="text" placeholder="메시지 입력..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChatMessage() }}
                  style={{
                    flex: 1, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                    background: colors.borderLight, border: `1px solid ${colors.border}`,
                    color: colors.textPrimary, fontSize: typography.sm, outline: 'none',
                    fontFamily: 'inherit',
                    transition: transitions.normal,
                  }}
                />
                <button onClick={sendChatMessage} style={{
                  padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md,
                  background: colors.accent, color: colors.bg, border: 'none',
                  fontWeight: typography.bold, cursor: 'pointer', fontSize: typography.sm,
                  fontFamily: 'inherit',
                  transition: transitions.normal,
                }}>전송</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
