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
} from '../data/gameData'
import type { Location, PlayerPosition, ChatMessage, TeamStage } from '../../../shared/types'

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
  const [timerDuration, setTimerDuration] = useState(30 * 60 * 1000)
  const [timerDisplay, setTimerDisplay] = useState('30:00')
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

    // Pledge check - redirect if no pledge
    socket.on('pledge:status', (data: { playerId: string; hasPledge: boolean }) => {
      if (data.playerId === playerId && !data.hasPledge) {
        navigate('/pledge')
      }
    })

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
      socket.off('pledge:status')
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
      if (!isTimerActive && !isTimerExpired && !isTimerPaused) setTimerDisplay('30:00')
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
  if (stage === 'idle' || stage === 'stage1_ready' || stage === 'stage1') {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif", display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#6fea8d' }}>팀 {teamId}</span>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isConnected ? '#6fea8d' : '#ef4444',
                display: 'inline-block',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#666' }}>
              {stage === 'idle' ? '대기 중' : stage === 'stage1_ready' ? 'Stage 1 준비' : 'Stage 1'}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
          {stage === 'idle' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🎼</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 }}>신의 악단</h2>
              <p style={{ fontSize: 14, color: '#666' }}>관리자가 게임을 시작할 때까지 대기해주세요</p>
            </div>
          )}

          {stage === 'stage1_ready' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🔐</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>Stage 1 준비</h2>
              <p style={{ fontSize: 14, color: '#888' }}>곧 시작됩니다. 준비해주세요!</p>
              <div style={{
                marginTop: 24, fontSize: 64, fontWeight: 700,
                color: 'rgba(245,158,11,0.3)', fontVariantNumeric: 'tabular-nums',
                fontFamily: 'monospace',
              }}>
                40:00
              </div>
            </div>
          )}

          {stage === 'stage1' && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              {/* Timer icon */}
              <div style={{ fontSize: 36, marginBottom: 16 }}>
                {s1TimerExpired ? '⏰' : s1TimerPaused ? '⏸️' : '🔐'}
              </div>

              {/* Stage label */}
              <div style={{ fontSize: 13, color: '#888', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                Stage 1
              </div>

              {/* Big timer */}
              <div style={{
                fontSize: 80, fontWeight: 700, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
                color: s1TimerExpired ? '#ef4444' : s1TimerPaused ? '#f59e0b' : '#e0e0e0',
                marginBottom: 16,
                animation: s1TimerPaused ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}>
                {s1TimerDisplay}
              </div>

              {/* Status text */}
              <div style={{ fontSize: 14, color: '#666' }}>
                {s1TimerExpired ? '시간이 종료되었습니다' : s1TimerPaused ? '일시정지됨' : s1TimerActive ? '진행 중...' : '대기 중'}
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '8px 16px',
            borderRadius: 8, fontSize: 13, zIndex: 100,
          }}>
            {errorMsg}
          </div>
        )}

        {/* Chat (always available for representative) */}
        {isRepresentative && (
          <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 110 }}>
            {!chatOpen && (
              <button
                onClick={() => setChatOpen(true)}
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#6fea8d', color: '#0a0a0f',
                  border: 'none', cursor: 'pointer',
                  fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(111,234,141,0.3)', position: 'relative',
                }}>
                💬
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>{unreadCount}</span>
                )}
              </button>
            )}
            {chatOpen && (
              <div style={{
                width: 300, height: 400, borderRadius: 16,
                background: '#111318', border: '1px solid rgba(111,234,141,0.15)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6fea8d' }}>관리자 채팅</span>
                  <button onClick={() => setChatOpen(false)} style={{
                    background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16,
                  }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                  {chatMessages.map((msg, i) => (
                    <div key={msg.id || i} style={{
                      marginBottom: 8, display: 'flex', flexDirection: 'column',
                      alignItems: msg.isAdmin ? 'flex-start' : 'flex-end',
                    }}>
                      <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>
                        {msg.isAdmin ? '관리자' : msg.senderName}
                      </div>
                      <div style={{
                        padding: '7px 11px', borderRadius: 10, maxWidth: '80%',
                        background: msg.isAdmin ? 'rgba(111,234,141,0.1)' : 'rgba(255,255,255,0.06)',
                        fontSize: 13, lineHeight: 1.4,
                      }}>{msg.message}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChatMessage() }}
                    placeholder="메시지 입력..."
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#e0e0e0', fontSize: 12, outline: 'none',
                      fontFamily: "'Noto Serif KR', serif",
                    }}
                  />
                  <button onClick={sendChatMessage} style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: chatInput.trim() ? '#6fea8d' : 'rgba(255,255,255,0.04)',
                    color: chatInput.trim() ? '#0a0a0f' : '#444',
                    border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
                    fontSize: 12, fontWeight: 600, fontFamily: "'Noto Serif KR', serif",
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
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6fea8d' }}>팀 {teamId}</span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? '#6fea8d' : '#ef4444',
              display: 'inline-block',
            }} />
          </div>
          <span style={{
            fontSize: 13, color: isTimerPaused ? '#f59e0b' : '#f59e0b', fontVariantNumeric: 'tabular-nums',
            background: isTimerPaused ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
            padding: '4px 10px', borderRadius: 6,
            animation: isTimerPaused ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}>
            {isTimerPaused ? '⏸' : '⏱'} {timerDisplay}
          </span>
        </div>
      </div>

      {/* GPS error */}
      {gpsError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px', fontSize: 12, color: '#f87171' }}>
          {gpsError}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div style={{ background: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.2)', padding: '8px 16px', fontSize: 12, color: '#ffc832' }}>
          {errorMsg}
        </div>
      )}

      {/* Waiting state */}
      {currentStep === 0 && !isTimerExpired && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            관리자가 타이머를 시작하면
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            게임이 시작됩니다
          </div>
        </div>
      )}

      {/* Timer expired overlay */}
      {isTimerExpired && !isComplete && showTimeoutOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>시간 초과</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>30분이 경과했습니다</p>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 300, marginBottom: 20 }}>
            <div style={{
              height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4,
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%', borderRadius: 4, background: '#6fea8d',
                width: `${Math.round((completedSteps.length / 3) * 100)}%`,
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
              3단계 중 {completedSteps.length}단계까지 완료
            </div>
          </div>

          {/* CCC Center notice */}
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: 16, marginBottom: 20,
            width: '100%', maxWidth: 300,
          }}>
            <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>
              📍 CCC 센터로 오세요!
            </div>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              시간이 종료되었습니다<br />센터로 돌아와 주세요
            </div>
          </div>

          <button
            onClick={() => setShowTimeoutOverlay(false)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 14,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
              color: '#888', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
              maxWidth: 300, width: '100%',
            }}
          >
            확인
          </button>
        </div>
      )}

      {/* Waiting state when timer expired (after dismissing overlay) */}
      {isTimerExpired && !isComplete && !showTimeoutOverlay && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>⏰</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
            임무 종료
          </div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 32 }}>
            시간이 종료되었습니다<br />관리자의 안내를 기다려주세요
          </div>
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: 16, maxWidth: 280, margin: '0 auto',
          }}>
            <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>
              📍 CCC 센터로 오세요!
            </div>
          </div>
        </div>
      )}

      {/* Game active content */}
      {currentStep > 0 && currentStep <= 3 && !isTimerExpired && (
        <>
          {/* Stage indicator dots */}
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              {[1, 2, 3].map(step => {
                const isCompleted = completedSteps.includes(step)
                const isCurrent = step === currentStep && !isComplete
                return (
                  <div key={step} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: isCompleted ? '#6fea8d' : isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                    boxShadow: isCurrent ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                  }} />
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>{currentStep}단계 / 3단계</div>
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
          <div style={{ padding: '12px 16px' }}>
            <HintCard hint={hint} />
          </div>

          {/* Location cards - horizontal */}
          <div style={{ padding: '0 16px' }}>
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 10 }}>
              후보 장소를 선택하여 이동하세요
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {visibleLocations.map(loc => {
                const info = getLocationInfo(loc)
                const isWrongGuess = showWrong?.locationId === loc.id

                return (
                  <button
                    key={loc.id}
                    onClick={() => handleCheckLocation(loc.id)}
                    disabled={isComplete || !isTimerActive || isTimerPaused}
                    style={{
                      flex: 1, textAlign: 'center', padding: 14,
                      borderRadius: 10,
                      background: isWrongGuess
                        ? 'rgba(239,68,68,0.08)'
                        : info.status === 'inside'
                        ? 'rgba(111,234,141,0.05)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${
                        isWrongGuess ? 'rgba(239,68,68,0.3)'
                        : info.status === 'inside' ? 'rgba(111,234,141,0.3)'
                        : 'rgba(255,255,255,0.08)'
                      }`,
                      color: '#e0e0e0', cursor: 'pointer',
                      fontFamily: "'Noto Serif KR', serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#eee' }}>{loc.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {info.distance !== null ? `${formatDistance(info.distance)} 거리` : '거리 계산 중'}
                    </div>
                    {info.status === 'inside' && (
                      <div style={{ fontSize: 11, color: '#6fea8d', marginTop: 4 }}>도착!</div>
                    )}
                    {info.status === 'approaching' && (
                      <div style={{ fontSize: 11, color: '#ffc832', marginTop: 4 }}>접근 중</div>
                    )}
                    {isWrongGuess && (
                      <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>오답</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Member count bar */}
          <div style={{ padding: '0 16px 24px' }}>
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
                  textAlign: 'center', fontSize: 12, color: '#888',
                  padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                }}>
                  현재 위치 근처 팀원: <span style={{ color: '#6fea8d', fontWeight: 600 }}>
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
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎶</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#6fea8d', marginBottom: 8 }}>
            {showStepComplete.stepNumber}단계 통과!
          </h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
            다음 장소를 향해 출발하세요
          </p>

          {/* Stage indicator dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {[1, 2, 3].map(step => {
              const isStepCompleted = completedSteps.includes(step)
              const isCurrent = step === currentStep && !isComplete
              return (
                <div key={step} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: isStepCompleted ? '#6fea8d' : isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                  boxShadow: isCurrent ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                }} />
              )
            })}
          </div>

          {showStepComplete.photo && (
            <div style={{
              width: '100%', maxWidth: 280, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20,
              border: '1px solid rgba(111,234,141,0.2)',
            }}>
              <img src={`/${showStepComplete.photo}`} alt="악보 조각" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <button
            onClick={() => setShowStepComplete(null)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: '#6fea8d', color: '#0a0a0f', border: 'none', cursor: 'pointer',
              fontFamily: "'Noto Serif KR', serif",
              maxWidth: 300, width: '100%',
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
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>이곳이 아닙니다</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>다른 장소를 찾아보세요</p>
          {showWrong.photo && (
            <div style={{
              width: '100%', maxWidth: 280, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20,
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
            }}>
              <img src={`/${showWrong.photo}`} alt="오답" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <button
            onClick={() => setShowWrong(null)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'rgba(239,68,68,0.8)', color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: "'Noto Serif KR', serif",
              maxWidth: 300, width: '100%',
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
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
            임무 완료!
          </h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
            모든 악보 조각을 찾았습니다
          </p>

          {/* Stage indicator dots - all completed */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {[1, 2, 3].map(step => (
              <div key={step} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#6fea8d',
              }} />
            ))}
          </div>

          {showComplete.photo && (
            <div style={{
              width: '100%', maxWidth: 280, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20,
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <img src={`/${showComplete.photo}`} alt="완성된 악보" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* CCC Center notice */}
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: 16, marginBottom: 20,
            width: '100%', maxWidth: 300,
          }}>
            <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>
              📍 CCC 센터로 오세요!
            </div>
          </div>

          <button
            onClick={() => setShowCompleteOverlay(false)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: '#6fea8d', color: '#0a0a0f', border: 'none', cursor: 'pointer',
              fontFamily: "'Noto Serif KR', serif",
              maxWidth: 300, width: '100%',
            }}
          >
            확인
          </button>
        </div>
      )}

      {/* Waiting state when game is complete (after dismissing overlay) */}
      {isComplete && !showCompleteOverlay && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>
            임무 완료
          </div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 32 }}>
            모든 악보 조각을 찾았습니다<br />관리자의 안내를 기다려주세요
          </div>
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12, padding: 16, maxWidth: 280, margin: '0 auto',
          }}>
            <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>
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
                position: 'fixed', bottom: 24, right: 24, zIndex: 110,
                width: 50, height: 50, borderRadius: '50%',
                background: '#6fea8d', color: '#0a0a0f', border: 'none',
                fontSize: 22, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(111,234,141,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              💬
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700,
                  width: 20, height: 20, borderRadius: '50%',
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
              position: 'fixed', bottom: 80, right: 20, zIndex: 110,
              width: 300, height: 400,
              background: '#0a0a0f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: "'Noto Serif KR', serif",
            }}>
              {/* Chat header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px',
                background: 'rgba(111,234,141,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#6fea8d' }}>관리자 채팅</span>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    background: 'none', border: 'none', color: '#888',
                    fontSize: 18, cursor: 'pointer',
                  }}
                >✕</button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#444', fontSize: 13, paddingTop: 30 }}>
                    관리자에게 메시지를 보내보세요
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={msg.id || i} style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: 12,
                      alignSelf: msg.isAdmin ? 'flex-start' : 'flex-end',
                      background: msg.isAdmin ? 'rgba(255,255,255,0.06)' : 'rgba(111,234,141,0.15)',
                      borderBottomLeftRadius: msg.isAdmin ? 4 : 12,
                      borderBottomRightRadius: msg.isAdmin ? 12 : 4,
                      fontSize: 13, lineHeight: 1.4, color: msg.isAdmin ? '#ccc' : '#ddd',
                    }}>
                      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                        {msg.senderName}
                      </div>
                      {msg.message}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <input
                  type="text" placeholder="메시지 입력..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendChatMessage() }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 13, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button onClick={sendChatMessage} style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: '#6fea8d', color: '#0a0a0f', border: 'none',
                  fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  fontFamily: 'inherit',
                }}>전송</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
