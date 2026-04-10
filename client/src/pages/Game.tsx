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
import type { Location, PlayerPosition, ChatMessage, TeamStage, GameState } from '../../../shared/types'
import { getCurrentStageInfo } from '../../../shared/types'
import { colors, typography, spacing, radius, shadows, transitions } from '../theme'

const DIRECTION_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const

function bearingToArrow(bearing: number): string {
  const idx = Math.round(bearing / 45) % 8
  return DIRECTION_ARROWS[idx]
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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

  // V3: Game state from server
  const [gameState, setGameState] = useState<GameState | null>(null)

  // V3: Computed stage (벽시계 기반, 매초 갱신)
  const [computedStage, setComputedStage] = useState<TeamStage>('idle')
  const [stageRemaining, setStageRemaining] = useState(0)

  // Stage 2 game state
  const [currentStep, setCurrentStep] = useState(0)
  const [hint, setHint] = useState('')
  const [stepLocations, setStepLocations] = useState<StepLocations | null>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [stage2Completed, setStage2Completed] = useState(false)
  const [teamMembers, setTeamMembers] = useState<PlayerPosition[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, { count: number; needed: number }>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  // Stage 2 규칙 확인 여부
  const [stage2RulesAcked, setStage2RulesAcked] = useState(false)

  // Overlays
  const [showStepComplete, setShowStepComplete] = useState<{ stepNumber: number } | null>(null)
  const [showWrong, setShowWrong] = useState<{ locationId: string } | null>(null)
  const [showStage2Complete, setShowStage2Complete] = useState(false)

  // Chat (representative only, all stages)
  const [chatOpen, setChatOpen] = useState(false)
  const chatOpenRef = useRef(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Team info
  const teamState = gameState?.teams[teamId]
  const group = teamState?.group || '가조'

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

    return () => { socket.off('connect', joinTeam) }
  }, [socket, isConnected, teamId, playerId, playerName, teamPassword, isRepresentative, joined])

  // V3: 벽시계 기반 Stage 계산 (매초 갱신)
  useEffect(() => {
    if (!gameState || !teamState) return

    const update = () => {
      if (!teamState.startTime || teamState.stage === 'idle') {
        setComputedStage(teamState.stage)
        setStageRemaining(0)
        return
      }
      const info = getCurrentStageInfo(teamState.startTime, teamState.group, gameState.durations)
      setComputedStage(info.stage)
      setStageRemaining(info.stageRemaining)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [gameState, teamState])

  // Listen for all game events
  useEffect(() => {
    if (!socket || !teamId) return

    socket.on('game:state', (state: GameState) => {
      setGameState(state)
      const team = state.teams[teamId]
      if (team) {
        setCurrentStep(team.currentStep)
        setCompletedSteps(team.completedSteps)
        setStage2Completed(!!team.stage2CompletedAt)
      }
    })

    socket.on('team:stageUpdate', (data) => {
      if (data.teamId === teamId) {
        setCurrentStep(data.currentStep)
        setHint(data.hint)
        setStepLocations(data.locations)
        setShowWrong(null)
      }
    })

    socket.on('team:stepComplete', (data) => {
      if (data.teamId === teamId) {
        setCompletedSteps(prev => [...prev, data.stepNumber])
        setShowStepComplete({ stepNumber: data.stepNumber })
        setShowWrong(null)
      }
    })

    socket.on('team:wrong', (data) => {
      if (data.teamId === teamId) {
        setShowWrong({ locationId: data.locationId })
      }
    })

    socket.on('team:stage2Complete', (data) => {
      if (data.teamId === teamId) {
        setStage2Completed(true)
        setShowStage2Complete(true)
        setShowStepComplete(null)
      }
    })

    socket.on('team:positions', (positions) => {
      setTeamMembers(positions.filter((p: PlayerPosition) => p.playerId !== playerId))
    })

    socket.on('team:memberCount', (data) => {
      setMemberCounts(prev => ({
        ...prev,
        [data.locationId]: { count: data.count, needed: data.needed },
      }))
    })

    socket.on('chat:message', (msg: ChatMessage) => {
      if (msg.teamId === teamId) {
        setChatMessages(prev => [...prev, msg])
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

    socket.on('error', (data) => {
      setErrorMsg(data.message)
      setTimeout(() => setErrorMsg(null), 4000)
    })

    return () => {
      socket.off('game:state')
      socket.off('team:stageUpdate')
      socket.off('team:stepComplete')
      socket.off('team:wrong')
      socket.off('team:stage2Complete')
      socket.off('team:positions')
      socket.off('team:memberCount')
      socket.off('chat:message')
      socket.off('chat:history')
      socket.off('error')
    }
  }, [socket, teamId, playerId])

  // Send GPS position to server
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

  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) setUnreadCount(0)
  }, [chatOpen])

  const sendChatMessage = useCallback(() => {
    if (!socket || !chatInput.trim()) return
    socket.emit('chat:send', { teamId, message: chatInput.trim() })
    setChatInput('')
    // 메시지 보낼 때만 자동 스크롤
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [socket, teamId, chatInput])

  // Check location handler (Stage 2 only)
  const handleCheckLocation = useCallback((locationId: string) => {
    if (!socket || stage2Completed || computedStage !== 'stage2') return
    socket.emit('player:checkLocation', { locationId })
  }, [socket, stage2Completed, computedStage])

  // Get visible locations for map
  const visibleLocations: Location[] = []
  if (stepLocations) {
    const loc1 = getLocationById(stepLocations.correctId)
    const loc2 = getLocationById(stepLocations.wrongId)
    if (loc1) visibleLocations.push(loc1)
    if (loc2) visibleLocations.push(loc2)
  }

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

  // ========== Chat Widget (shared across all stages) ==========
  const chatWidget = !isRepresentative ? null : (
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
  )

  // ========== Error Banner ==========
  const ErrorBanner = () => errorMsg ? (
    <div style={{
      position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
      background: colors.error, color: colors.textPrimary, padding: `${spacing.sm}px ${spacing.lg}px`,
      borderRadius: radius.md, fontSize: typography.sm, zIndex: 100,
    }}>
      {errorMsg}
    </div>
  ) : null

  // ========== Header ==========
  const Header = ({ stageLabel }: { stageLabel: string }) => (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>{stageLabel}</span>
          {computedStage !== 'idle' && computedStage !== 'finished' && (
            <span style={{
              fontSize: typography.sm, color: colors.warning, fontVariantNumeric: 'tabular-nums',
              background: colors.warningBorder, padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.sm,
            }}>
              ⏱ {formatTime(stageRemaining)}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  // ========== IDLE ==========
  if (computedStage === 'idle') {
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
        <Header stageLabel="대기 중" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: spacing.xl }}>🎼</div>
            <h2 style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.textPrimary, marginBottom: spacing.md }}>신의 악단</h2>
            <p style={{ fontSize: typography.base, color: colors.textSecondary }}>관리자가 게임을 시작할 때까지 대기해주세요</p>
          </div>
        </div>
        <ErrorBanner />
        {chatWidget}
      </div>
    )
  }

  // ========== STAGE 1 (실내 방탈출) ==========
  if (computedStage === 'stage1') {
    const isNajo = group === '나조'
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
        <Header stageLabel="Stage 1" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 36, marginBottom: spacing.lg }}>🔐</div>
            <div style={{ fontSize: typography.sm, color: colors.textMuted, letterSpacing: typography.label, textTransform: 'uppercase', marginBottom: spacing.md }}>
              Stage 1
            </div>
            <div style={{
              fontSize: typography.timer, fontWeight: typography.bold, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', fontFamily: typography.monoFamily,
              color: colors.textPrimary, marginBottom: spacing.lg,
            }}>
              {formatTime(stageRemaining)}
            </div>
            <div style={{ fontSize: typography.base, color: colors.textSecondary, marginBottom: spacing.xl }}>
              진행 중...
            </div>

            {/* 나조 특별 안내 */}
            {isNajo && (
              <div style={{
                background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
                borderRadius: radius.lg, padding: spacing.lg, maxWidth: 340, margin: '0 auto',
              }}>
                <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold, marginBottom: spacing.xs }}>
                  📍 안내
                </div>
                <div style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                  센터 1층에서 미션 봉투를 받아서<br />Stage 1을 진행하세요
                </div>
              </div>
            )}

            {/* Stage 1 완료 여부 표시 */}
            {teamState?.stage1CompletedAt && (
              <div style={{
                marginTop: spacing.xl,
                background: colors.accentMuted, border: `1px solid ${colors.accentBorder}`,
                borderRadius: radius.lg, padding: spacing.lg, maxWidth: 340, margin: `${spacing.xl}px auto 0`,
              }}>
                <div style={{ fontSize: typography.base, color: colors.accent, fontWeight: typography.semibold }}>
                  ✅ 미션 완료! 수고하셨습니다
                </div>
              </div>
            )}
          </div>
        </div>
        <ErrorBanner />
        {chatWidget}
      </div>
    )
  }

  // ========== STAGE 2 (실외 GPS 미션) ==========
  if (computedStage === 'stage2') {
    const isNajo = group === '나조'

    // 규칙 안내 화면 (확인 전)
    if (!stage2RulesAcked) {
      return (
        <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
          <Header stageLabel="Stage 2 준비" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xl}px ${spacing.xl}px` }}>
            <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 48, marginBottom: spacing.lg }}>🗺️</div>
              <div style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.accent, marginBottom: spacing.sm }}>Stage 2 준비</div>
              <div style={{ fontSize: typography.base, color: colors.textMuted, marginBottom: spacing.xl }}>규칙을 확인하세요!</div>

              {/* Game Rules */}
              <div style={{
                background: colors.borderLight, border: `1px solid ${colors.border}`,
                borderRadius: radius.lg, padding: spacing.lg, textAlign: 'left',
                marginBottom: spacing.xl,
              }}>
                {[
                  { icon: '📍', title: '장소 찾기', desc: '힌트를 읽고 3개의 장소를 순서대로 찾아가세요. 각 단계마다 2곳 중 정답 장소를 골라야 합니다.' },
                  { icon: '⏱', title: '제한 시간', desc: '제한 시간 안에 3개의 장소를 모두 찾으면 악보 조각을 획득합니다.' },
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

              {/* Timer (계속 흐름) */}
              <div style={{
                fontSize: typography.timer, fontWeight: typography.bold, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', fontFamily: typography.monoFamily,
                color: colors.textSecondary, marginBottom: spacing.xl,
              }}>
                {formatTime(stageRemaining)}
              </div>

              {/* 시작 버튼 */}
              <button
                onClick={() => setStage2RulesAcked(true)}
                style={{
                  width: '100%', padding: `${spacing.md}px`, borderRadius: radius.md,
                  background: colors.accent, color: colors.bg, border: 'none',
                  fontSize: typography.base, fontWeight: typography.semibold,
                  cursor: 'pointer', fontFamily: typography.fontFamily,
                }}>
                규칙을 다 읽었습니다. Stage 2 시작!
              </button>
            </div>
          </div>
          <ErrorBanner />
          {chatWidget}
        </div>
      )
    }

    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily }}>
        <Header stageLabel={`Stage 2 · ${currentStep}단계`} />

        {/* GPS error */}
        {gpsError && (
          <div style={{ background: colors.errorBg, borderBottom: `1px solid ${colors.errorBorder}`, padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: typography.sm, color: colors.error }}>
            {gpsError}
          </div>
        )}

        <ErrorBanner />

        {/* Stage 2 all completed */}
        {stage2Completed && (
          <div style={{ padding: `${spacing.xxxl}px ${spacing.lg}px`, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: spacing.lg }}>🏆</div>
            <div style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.accent, marginBottom: spacing.md }}>
              임무 완료!
            </div>
            <div style={{ fontSize: typography.sm, color: colors.textMuted, lineHeight: 1.6, marginBottom: spacing.xl }}>
              모든 악보 조각을 찾았습니다
            </div>

            {/* 나조 특별 메시지 */}
            {isNajo && (
              <div style={{
                background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
                borderRadius: radius.lg, padding: spacing.lg, maxWidth: 300, margin: '0 auto',
              }}>
                <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold, marginBottom: spacing.xs }}>
                  📍 센터 1층으로 오세요!
                </div>
                <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                  센터 1층에서 미션 봉투 받아가세요
                </div>
              </div>
            )}
            {!isNajo && (
              <div style={{
                background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
                borderRadius: radius.lg, padding: spacing.lg, maxWidth: 300, margin: '0 auto',
              }}>
                <div style={{ fontSize: typography.base, color: colors.warning, fontWeight: typography.semibold }}>
                  📍 CCC 센터로 오세요!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Game active: steps in progress */}
        {!stage2Completed && currentStep >= 1 && currentStep <= 3 && (
          <>
            {/* Stage indicator dots */}
            <div style={{ textAlign: 'center', margin: `${spacing.lg}px 0` }}>
              <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md }}>
                {[1, 2, 3].map(step => {
                  const isCompleted = completedSteps.includes(step)
                  const isCurrent = step === currentStep
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

            {/* Location cards */}
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
                      disabled={stage2Completed}
                      style={{
                        flex: 1, textAlign: 'center', padding: spacing.lg,
                        borderRadius: radius.md,
                        background: isWrongGuess ? colors.errorBg
                          : info.status === 'inside' ? colors.accentMuted : colors.borderLight,
                        border: `1px solid ${
                          isWrongGuess ? colors.errorBorder
                          : info.status === 'inside' ? colors.accentBorder : colors.border
                        }`,
                        color: colors.textPrimary, cursor: 'pointer',
                        fontFamily: typography.fontFamily, transition: transitions.normal,
                      }}
                    >
                      <div style={{ fontSize: typography.base, fontWeight: typography.semibold, marginBottom: spacing.xs }}>{loc.name}</div>
                      <div style={{ fontSize: typography.xs, color: colors.textMuted }}>
                        {info.distance !== null ? `${formatDistance(info.distance)} 거리` : '거리 계산 중'}
                      </div>
                      {info.status === 'inside' && <div style={{ fontSize: typography.xs, color: colors.accent, marginTop: spacing.xs }}>도착!</div>}
                      {info.status === 'approaching' && <div style={{ fontSize: typography.xs, color: colors.warning, marginTop: spacing.xs }}>접근 중</div>}
                      {isWrongGuess && <div style={{ fontSize: typography.xs, color: colors.error, marginTop: spacing.xs }}>오답</div>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Member count bar */}
            <div style={{ padding: `0 ${spacing.lg}px ${spacing.xl}px` }}>
              {(() => {
                const counts = visibleLocations.map(loc => memberCounts[loc.id]).filter(Boolean)
                const best = counts.length > 0 ? counts.reduce((a, b) => a.count >= b.count ? a : b) : null
                const count = best ? best.count : 0
                const needed = best ? best.needed : 3
                const unlocked = count >= needed
                return (
                  <div style={{
                    textAlign: 'center', fontSize: typography.sm, color: colors.textMuted,
                    padding: spacing.sm, background: colors.borderLight, borderRadius: radius.md,
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

        {/* Waiting for step data */}
        {!stage2Completed && currentStep === 0 && (
          <div style={{ padding: `${spacing.xxxl}px ${spacing.lg}px`, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: spacing.lg }}>⏳</div>
            <div style={{ fontSize: typography.md, fontWeight: typography.semibold, color: colors.textSecondary }}>
              Stage 2 준비 중...
            </div>
          </div>
        )}

        {/* Step Complete Overlay */}
        {showStepComplete && !showStage2Complete && (
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
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.xl }}>
              {[1, 2, 3].map(step => (
                <div key={step} style={{
                  width: 10, height: 10, borderRadius: radius.full,
                  background: completedSteps.includes(step) ? colors.accent : step === currentStep ? colors.warning : colors.border,
                  transition: transitions.normal,
                }} />
              ))}
            </div>
            <button
              onClick={() => setShowStepComplete(null)}
              style={{
                padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
                background: colors.accent, color: colors.bg, border: 'none', cursor: 'pointer',
                fontFamily: typography.fontFamily, maxWidth: 300, width: '100%', transition: transitions.normal,
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
            <button
              onClick={() => setShowWrong(null)}
              style={{
                padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
                background: colors.error, color: colors.textPrimary, border: 'none', cursor: 'pointer',
                fontFamily: typography.fontFamily, maxWidth: 300, width: '100%', transition: transitions.normal,
              }}
            >
              다른 장소로 이동
            </button>
          </div>
        )}

        {/* Stage 2 Complete Overlay */}
        {showStage2Complete && (
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
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.xl }}>
              {[1, 2, 3].map(step => (
                <div key={step} style={{ width: 10, height: 10, borderRadius: radius.full, background: colors.accent }} />
              ))}
            </div>
            <button
              onClick={() => setShowStage2Complete(false)}
              style={{
                padding: `${spacing.lg}px ${spacing.xxxl}px`, borderRadius: radius.pill, fontSize: typography.base, fontWeight: typography.bold,
                background: colors.accent, color: colors.bg, border: 'none', cursor: 'pointer',
                fontFamily: typography.fontFamily, maxWidth: 300, width: '100%', transition: transitions.normal,
              }}
            >
              확인
            </button>
          </div>
        )}

        {chatWidget}
      </div>
    )
  }

  // ========== STAGE 3 (마무리) ==========
  if (computedStage === 'stage3') {
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
        <Header stageLabel="Stage 3" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: spacing.xl }}>🎵</div>
            <div style={{ fontSize: typography.sm, color: colors.textMuted, letterSpacing: typography.label, textTransform: 'uppercase', marginBottom: spacing.md }}>
              Stage 3
            </div>
            <div style={{
              fontSize: typography.timer, fontWeight: typography.bold, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', fontFamily: typography.monoFamily,
              color: colors.textPrimary, marginBottom: spacing.xl,
            }}>
              {formatTime(stageRemaining)}
            </div>

            <div style={{
              background: colors.warningBg, border: `1px solid ${colors.warningBorder}`,
              borderRadius: radius.lg, padding: spacing.lg, maxWidth: 340, margin: '0 auto',
            }}>
              <div style={{ fontSize: typography.lg, color: colors.warning, fontWeight: typography.semibold, marginBottom: spacing.xs }}>
                📍 센터 3층으로 오세요!
              </div>
              <div style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                마지막 합주를 위해 센터 3층으로 모여주세요
              </div>
            </div>
          </div>
        </div>
        <ErrorBanner />
        {chatWidget}
      </div>
    )
  }

  // ========== FINISHED ==========
  if (computedStage === 'finished') {
    return (
      <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', flexDirection: 'column' }}>
        <Header stageLabel="종료" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: spacing.xl }}>🎼</div>
            <h2 style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.accent, marginBottom: spacing.md }}>
              게임 종료
            </h2>
            <p style={{ fontSize: typography.base, color: colors.textSecondary }}>
              수고하셨습니다!
            </p>
          </div>
        </div>
        <ErrorBanner />
        {chatWidget}
      </div>
    )
  }

  // Fallback
  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.textPrimary, fontFamily: typography.fontFamily, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </div>
  )
}
