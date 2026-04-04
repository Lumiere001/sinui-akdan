import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGPS } from '../hooks/useGPS'
import { useSocket } from '../hooks/useSocket'
import { MapView } from '../components/MapView'
import { HintCard } from '../components/HintCard'
import {
  getTeamConfig,
  getTeamVisibleLocations,
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

export function Game() {
  const navigate = useNavigate()
  const { position, error: gpsError } = useGPS()
  const { socket, isConnected } = useSocket()

  // 로그인 정보
  const [teamId] = useState<number>(() => {
    const saved = localStorage.getItem('teamId')
    return saved ? parseInt(saved, 10) : 0
  })
  const [playerId] = useState<string>(() => {
    let id = localStorage.getItem('playerId')
    if (!id) {
      id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      localStorage.setItem('playerId', id)
    }
    return id
  })
  const [teamPassword] = useState<string>(() => {
    return localStorage.getItem('teamPassword') || ''
  })

  // 게임 상태
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [scorePhoto, setScorePhoto] = useState<string | null>(null)
  const [wrongGuess, setWrongGuess] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState<{ count: number; needed: number; locationId?: string } | null>(null)
  const [gameActive, setGameActive] = useState(false)
  const [serverTime, setServerTime] = useState<{ startTime: number; duration: number } | null>(null)
  const [timerDisplay, setTimerDisplay] = useState('00:00')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<PlayerPosition[]>([])

  // 팀 설정
  const teamConfig = getTeamConfig(teamId)
  const visibleLocations = getTeamVisibleLocations(teamId)
  const teamRound = getTeamRound(teamId)

  // 로그인 안 되어 있으면 홈으로
  useEffect(() => {
    if (!teamId || !teamConfig) navigate('/')
  }, [teamId, teamConfig, navigate])

  // Socket 연결 및 이벤트 처리
  useEffect(() => {
    if (!socket || !teamId) return

    // 팀 참가 (최초 연결 + 재연결 시)
    const joinTeam = () => {
      socket.emit('player:join', { teamId, playerId, password: teamPassword })
    }
    joinTeam()
    socket.on('connect', joinTeam)

    // 게임 상태 수신
    socket.on('game:state', (state) => {
      setGameActive(state.isActive)
      if (state.startTime) {
        setServerTime({ startTime: state.startTime, duration: state.duration })
      }
      // 이미 해금한 팀인지 확인
      const teamState = state.teams[teamId]
      if (teamState?.unlockedLocation) {
        setUnlocked(true)
        setScorePhoto(teamState.scorePhoto)
      }
    })

    // 정답!
    socket.on('team:unlock', (data) => {
      if (data.teamId === teamId) {
        setUnlocked(true)
        setScorePhoto(data.photo)
        setWrongGuess(null)
        navigate('/result/correct', { state: { photoUrl: data.photo } })
      }
    })

    // 오답
    socket.on('team:wrong', (data) => {
      if (data.teamId === teamId) {
        setWrongGuess(data.locationId)
        setTimeout(() => setWrongGuess(null), 3000)
      }
    })

    // 팀원 수 (위치별로 지속적으로 업데이트됨)
    socket.on('team:memberCount', (data) => {
      setMemberCount({ count: data.count, needed: data.needed, locationId: data.locationId })
    })

    // 팀원 위치 업데이트
    socket.on('team:positions', (positions: PlayerPosition[]) => {
      // 자신을 제외한 팀원들의 위치만 저장
      setTeamMembers(positions.filter(p => p.playerId !== playerId))
    })

    // 에러
    socket.on('error', (data) => {
      setErrorMsg(data.message)
      setTimeout(() => setErrorMsg(null), 4000)
    })

    return () => {
      socket.off('connect', joinTeam)
      socket.off('game:state')
      socket.off('team:unlock')
      socket.off('team:wrong')
      socket.off('team:memberCount')
      socket.off('team:positions')
      socket.off('error')
    }
  }, [socket, teamId, playerId, teamPassword, navigate])

  // GPS 위치 서버에 전송
  useEffect(() => {
    if (!socket || !position || !teamId) return
    socket.emit('player:position', {
      playerId,
      teamId,
      lat: position.lat,
      lng: position.lng,
      timestamp: Date.now(),
    })
  }, [socket, position, teamId, playerId])

  // 타이머
  useEffect(() => {
    if (!gameActive || !serverTime) {
      setTimerDisplay('00:00')
      return
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - serverTime.startTime
      const remaining = Math.max(0, serverTime.duration - elapsed)
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setTimerDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      if (remaining <= 0) {
        setGameActive(false)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gameActive, serverTime])

  // 장소 선택하여 체크
  const handleCheckLocation = useCallback((locationId: string) => {
    if (!socket || unlocked) return
    setSelectedLocation(locationId)
    socket.emit('player:checkLocation', { locationId })
  }, [socket, unlocked])

  // 각 장소까지의 거리/방향 계산
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

  if (!teamConfig) return null

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0', fontFamily: "'Noto Serif KR', serif" }}>
      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>팀 {teamId}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              라운드 {teamRound} · {unlocked ? '해금 완료 ✓' : '탐색 중'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600, color: gameActive ? '#6fea8d' : '#888' }}>
              {timerDisplay}
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isConnected ? '#6fea8d' : '#ef4444',
              display: 'inline-block',
            }} />
          </div>
        </div>
      </div>

      {/* GPS 에러 */}
      {gpsError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px', fontSize: 12, color: '#f87171' }}>
          {gpsError}
        </div>
      )}

      {/* 에러 메시지 */}
      {errorMsg && (
        <div style={{ background: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.2)', padding: '8px 16px', fontSize: 12, color: '#ffc832' }}>
          {errorMsg}
        </div>
      )}

      {/* 게임 비활성 안내 */}
      {!gameActive && !unlocked && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', textAlign: 'center', fontSize: 13, color: '#888' }}>
          ⏳ 관리자가 라운드를 시작하면 게임이 시작됩니다
        </div>
      )}

      {/* 지도 */}
      <div style={{ width: '100%', height: '35vh', minHeight: 200 }}>
        <MapView
          locations={visibleLocations}
          playerPosition={position ? { lat: position.lat, lng: position.lng } : null}
          teamMemberPositions={teamMembers.filter(m => m.lat !== 0 && m.lng !== 0).map(m => ({ lat: m.lat, lng: m.lng }))}
          onLocationSelect={handleCheckLocation}
        />
      </div>

      {/* 힌트 카드 */}
      <div style={{ padding: '12px 16px' }}>
        <HintCard hint={teamConfig.hint} />
      </div>

      {/* 팀원 수 안내 */}
      {memberCount && (
        <div style={{
          margin: '0 16px 12px', padding: '10px 14px', borderRadius: 8,
          background: memberCount.count >= memberCount.needed ? 'rgba(111,234,141,0.1)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${memberCount.count >= memberCount.needed ? 'rgba(111,234,141,0.2)' : 'rgba(251,191,36,0.2)'}`,
          fontSize: 13,
        }}>
          👥 현재 위치에 팀원 <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{memberCount.count}/{memberCount.needed}</span>명
          {memberCount.count < memberCount.needed && ' — 팀원이 더 모여야 합니다'}
          {memberCount.count >= memberCount.needed && ' ✓ 해금 가능!'}
        </div>
      )}

      {/* 오답 알림 */}
      {wrongGuess && (
        <div style={{
          margin: '0 16px 12px', padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: '#f87171', textAlign: 'center',
        }}>
          ✕ 이 장소는 정답이 아닙니다. 힌트를 다시 읽어보세요!
        </div>
      )}

      {/* 장소 목록 */}
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
          탐색 장소 ({visibleLocations.length}곳 중 1곳이 정답)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleLocations.map((loc) => {
            const info = getLocationInfo(loc)
            const isWrong = wrongGuess === loc.id
            const isSelected = selectedLocation === loc.id

            return (
              <button
                key={loc.id}
                onClick={() => handleCheckLocation(loc.id)}
                disabled={unlocked || !gameActive}
                style={{
                  width: '100%', textAlign: 'left', padding: '14px 16px',
                  borderRadius: 10,
                  background: isWrong
                    ? 'rgba(239,68,68,0.08)'
                    : isSelected
                    ? 'rgba(111,234,141,0.06)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    isWrong ? 'rgba(239,68,68,0.3)' : isSelected ? 'rgba(111,234,141,0.2)' : 'rgba(255,255,255,0.06)'
                  }`,
                  color: '#e0e0e0',
                  cursor: unlocked || !gameActive ? 'default' : 'pointer',
                  opacity: unlocked ? 0.5 : 1,
                  fontFamily: "'Noto Serif KR', serif",
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: info.status === 'inside' ? 'rgba(111,234,141,0.15)' :
                                  info.status === 'approaching' ? 'rgba(255,200,50,0.15)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                      color: info.status === 'inside' ? '#6fea8d' :
                             info.status === 'approaching' ? '#ffc832' : '#888',
                    }}>
                      📍
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{loc.name}</div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {info.status === 'inside' && <span style={{ color: '#6fea8d' }}>도착! · 해금 가능</span>}
                        {info.status === 'approaching' && <span style={{ color: '#ffc832' }}>접근 중</span>}
                        {info.status === 'outside' && '탐색 중'}
                        {isWrong && <span style={{ color: '#f87171' }}> · 오답</span>}
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

      {/* 해금 완료 */}
      {unlocked && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '20px 16px', background: 'linear-gradient(transparent, #0a0a0f 30%)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎵</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#6fea8d' }}>악보 조각을 획득했습니다!</div>
          {scorePhoto && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{scorePhoto}</div>}
        </div>
      )}
    </div>
  )
}
