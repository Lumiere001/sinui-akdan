import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGPS } from '../hooks/useGPS'
import { useSocket } from '../hooks/useSocket'
import { MapView } from '../components/MapView'
import { HintCard } from '../components/HintCard'
import {
  getLocationById,
  calculateDistance,
  getDirectionBearing,
  getTeamRound,
} from '../data/gameData'
import type { Location, PlayerPosition } from '../../../shared/types'

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

  // Game state
  const [currentStep, setCurrentStep] = useState(0)
  const [hint, setHint] = useState('')
  const [stepLocations, setStepLocations] = useState<StepLocations | null>(null)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [isTimerActive, setIsTimerActive] = useState(false)
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

  const teamRound = getTeamRound(teamId)

  // Redirect if not logged in
  useEffect(() => {
    if (!teamId || !playerId) navigate('/')
  }, [teamId, playerId, navigate])

  // Socket events
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

    // Pledge check - redirect if no pledge
    socket.on('pledge:status', (data) => {
      if (data.playerId === playerId && !data.hasPledge) {
        navigate('/pledge')
      }
    })

    // Game state
    socket.on('game:state', (state) => {
      const team = state.teams[teamId]
      if (team) {
        setCurrentStep(team.currentStep)
        setCompletedSteps(team.completedSteps)
        setIsComplete(team.isComplete)
        setIsTimerActive(team.isTimerActive)
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

    socket.on('team:timerExpired', (data) => {
      if (data.teamId === teamId) {
        setIsTimerActive(false)
        setIsTimerExpired(true)
      }
    })

    // Team positions
    socket.on('team:positions', (positions) => {
      setTeamMembers(positions.filter(p => p.playerId !== playerId))
    })

    // Member count at locations
    socket.on('team:memberCount', (data) => {
      setMemberCounts(prev => ({
        ...prev,
        [data.locationId]: { count: data.count, needed: data.needed },
      }))
    })

    // Error
    socket.on('error', (data) => {
      setErrorMsg(data.message)
      setTimeout(() => setErrorMsg(null), 4000)
    })

    return () => {
      socket.off('connect', joinTeam)
      socket.off('pledge:status')
      socket.off('game:state')
      socket.off('team:stageUpdate')
      socket.off('team:stepComplete')
      socket.off('team:wrong')
      socket.off('team:complete')
      socket.off('team:timerStart')
      socket.off('team:timerExpired')
      socket.off('team:positions')
      socket.off('team:memberCount')
      socket.off('error')
    }
  }, [socket, isConnected, teamId, playerId, playerName, teamPassword, isRepresentative, joined, navigate])

  // Send GPS position to server
  useEffect(() => {
    if (!socket || !position || !teamId) return
    socket.emit('player:position', {
      playerId, teamId,
      lat: position.lat, lng: position.lng,
      timestamp: Date.now(),
    })
  }, [socket, position, teamId, playerId])

  // Timer display
  useEffect(() => {
    if (!isTimerActive || !timerStartTime) {
      if (!isTimerActive && !isTimerExpired) setTimerDisplay('30:00')
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
  }, [isTimerActive, timerStartTime, timerDuration, isTimerExpired])

  // Check location handler
  const handleCheckLocation = useCallback((locationId: string) => {
    if (!socket || isComplete || !isTimerActive) return
    socket.emit('player:checkLocation', { locationId })
  }, [socket, isComplete, isTimerActive])

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

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>팀 {teamId}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              라운드 {teamRound} · {isComplete ? '완료!' : currentStep > 0 ? `${currentStep}단계 진행 중` : '대기 중'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 20, fontWeight: 600,
              color: isTimerActive ? '#6fea8d' : isTimerExpired ? '#ef4444' : '#888',
            }}>
              {timerDisplay}
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isConnected ? '#6fea8d' : '#ef4444',
              display: 'inline-block',
            }} />
          </div>
        </div>

        {/* Step progress bar */}
        {currentStep > 0 && (
          <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
            {[1, 2, 3].map(step => {
              const isCompleted = completedSteps.includes(step)
              const isCurrent = step === currentStep && !isComplete
              return (
                <div key={step} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: isCompleted ? '#6fea8d' : isCurrent ? '#d4a853' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s',
                }} />
              )
            })}
          </div>
        )}
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

      {/* Timer expired */}
      {isTimerExpired && !isComplete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>⏰</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>시간 종료!</h2>
          <p style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
            30분이 모두 지났습니다.<br />관리자의 안내를 기다려주세요.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 32px', borderRadius: 10, fontSize: 14,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#888', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
            }}
          >
            홈으로
          </button>
        </div>
      )}

      {/* Game active content */}
      {currentStep > 0 && currentStep <= 3 && !isTimerExpired && (
        <>
          {/* Step indicator */}
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
              fontSize: 12, fontWeight: 700, color: '#d4a853',
            }}>
              {currentStep}단계
            </span>
            <span style={{ fontSize: 12, color: '#666' }}>
              2곳 중 정답 장소를 찾아가세요
            </span>
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

          {/* Location cards */}
          <div style={{ padding: '0 16px 24px' }}>
            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              후보 장소 (2곳 중 1곳이 정답)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleLocations.map(loc => {
                const info = getLocationInfo(loc)
                const mc = memberCounts[loc.id]
                const isWrongGuess = showWrong?.locationId === loc.id

                return (
                  <button
                    key={loc.id}
                    onClick={() => handleCheckLocation(loc.id)}
                    disabled={isComplete || !isTimerActive}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 16px',
                      borderRadius: 10,
                      background: isWrongGuess
                        ? 'rgba(239,68,68,0.08)'
                        : info.status === 'inside'
                        ? 'rgba(111,234,141,0.06)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${
                        isWrongGuess ? 'rgba(239,68,68,0.3)'
                        : info.status === 'inside' ? 'rgba(111,234,141,0.2)'
                        : 'rgba(255,255,255,0.06)'
                      }`,
                      color: '#e0e0e0', cursor: 'pointer',
                      fontFamily: "'Noto Serif KR', serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: info.status === 'inside' ? 'rgba(111,234,141,0.15)' :
                                      info.status === 'approaching' ? 'rgba(255,200,50,0.15)' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                        }}>
                          📍
                        </span>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{loc.name}</div>
                          <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                            {info.status === 'inside' && <span style={{ color: '#6fea8d' }}>도착!</span>}
                            {info.status === 'approaching' && <span style={{ color: '#ffc832' }}>접근 중</span>}
                            {info.status === 'outside' && '탐색 중'}
                            {isWrongGuess && <span style={{ color: '#f87171' }}> · 오답</span>}
                            {mc && (
                              <span style={{ marginLeft: 8, color: mc.count >= mc.needed ? '#6fea8d' : '#888' }}>
                                👥 {mc.count}/{mc.needed}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {info.distance !== null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: info.status === 'inside' ? '#6fea8d' : '#ccc' }}>
                            {formatDistance(info.distance)}
                          </div>
                          <div style={{ fontSize: 16, color: '#888' }}>{info.arrow}</div>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#6fea8d', marginBottom: 8 }}>
            {showStepComplete.stepNumber}단계 완료!
          </h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
            정답 장소를 찾았습니다
          </p>
          {showStepComplete.photo && (
            <div style={{
              width: '100%', maxWidth: 300, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20,
              border: '1px solid rgba(111,234,141,0.2)',
            }}>
              <img src={`/${showStepComplete.photo}`} alt="악보 조각" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <button
            onClick={() => setShowStepComplete(null)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: '#6fea8d', color: '#0a0a0f', border: 'none', cursor: 'pointer',
              fontFamily: "'Noto Serif KR', serif",
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
          <div style={{
            width: 70, height: 70, borderRadius: 16, marginBottom: 20,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>
            ✕
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>오답입니다</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>다른 장소를 찾아보세요</p>
          {showWrong.photo && (
            <div style={{
              width: '100%', maxWidth: 300, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20,
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <img src={`/${showWrong.photo}`} alt="오답" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <button
            onClick={() => setShowWrong(null)}
            style={{
              padding: '14px 40px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: 'rgba(239,68,68,0.8)', color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: "'Noto Serif KR', serif",
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Game Complete Overlay */}
      {showComplete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,10,15,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎼</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#d4a853', marginBottom: 8 }}>
            미션 완료!
          </h2>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>
            3개의 장소를 모두 찾았습니다
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
            하나님의 악보가 완성되었습니다
          </p>
          {showComplete.photo && (
            <div style={{
              width: '100%', maxWidth: 320, aspectRatio: '4/3', borderRadius: 12,
              overflow: 'hidden', marginBottom: 24,
              border: '2px solid rgba(212,168,83,0.3)',
            }}>
              <img src={`/${showComplete.photo}`} alt="완성된 악보" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 28, color: 'rgba(212,168,83,0.5)' }}>
            {'♪♫♩♫♪'.split('').map((note, i) => (
              <span key={i}>{note}</span>
            ))}
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 32px', borderRadius: 10, fontSize: 14,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#888', cursor: 'pointer', fontFamily: "'Noto Serif KR', serif",
            }}
          >
            홈으로
          </button>
        </div>
      )}
    </div>
  )
}
