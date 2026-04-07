import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSocket } from '../hooks/useSocket'

export function Pledge() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [joined, setJoined] = useState(false)

  const teamId = parseInt(localStorage.getItem('teamId') || '0', 10)
  const playerId = localStorage.getItem('playerId') || ''
  const playerName = localStorage.getItem('playerName') || ''
  const teamPassword = localStorage.getItem('teamPassword') || ''
  const isRepresentative = localStorage.getItem('isRepresentative') === 'true'

  // Redirect if not logged in
  useEffect(() => {
    if (!teamId || !playerId || !playerName) {
      navigate('/')
    }
  }, [teamId, playerId, playerName, navigate])

  // Join team (once)
  useEffect(() => {
    if (!socket || !teamId || joined) return

    const joinTeam = () => {
      socket.emit('player:join', {
        teamId,
        playerId,
        playerName,
        password: teamPassword,
        isRepresentative,
      })
      setJoined(true)
    }

    if (isConnected) {
      joinTeam()
    }

    socket.on('connect', joinTeam)

    return () => {
      socket.off('connect', joinTeam)
    }
  }, [socket, isConnected, teamId, playerId, playerName, teamPassword, isRepresentative, joined])

  // Listen for pledge status (always active)
  useEffect(() => {
    if (!socket) return

    const handlePledgeStatus = (data: { playerId: string; hasPledge: boolean }) => {
      if (data.playerId === playerId && data.hasPledge) {
        navigate('/game')
      }
    }

    socket.on('pledge:status', handlePledgeStatus)

    return () => {
      socket.off('pledge:status', handlePledgeStatus)
    }
  }, [socket, playerId, navigate])

  const handleSubmit = () => {
    if (!socket || !agreed) return
    setSubmitting(true)
    socket.emit('pledge:submit', { playerId, teamId })
    // The pledge:status event handler above will redirect to /game
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <motion.div
        style={{ width: '100%', maxWidth: '380px' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(212,168,83,0.1)',
            border: '1px solid rgba(212,168,83,0.2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', marginBottom: '20px',
          }}>
            📜
          </div>
          <h1 style={{
            fontSize: '22px', fontWeight: '700',
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.02em', marginBottom: '8px',
            fontFamily: "'Noto Serif KR', serif",
          }}>
            악단원 서약
          </h1>
          <p style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.4)',
            fontFamily: "'Noto Serif KR', serif",
          }}>
            게임을 시작하기 전에 서약에 동의해주세요
          </p>
        </div>

        {/* Pledge text */}
        <div style={{
          padding: '24px 20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '14px', color: 'rgba(255,255,255,0.6)',
            lineHeight: 2, fontFamily: "'Noto Serif KR', serif",
          }}>
            <p style={{ marginBottom: '16px' }}>
              나 <span style={{ color: '#d4a853', fontWeight: '700' }}>{playerName}</span>은(는)
            </p>
            <p style={{ marginBottom: '12px' }}>
              하나, 팀원들과 함께 협력하여 미션을 수행하겠습니다.
            </p>
            <p style={{ marginBottom: '12px' }}>
              하나, 안전하게 이동하며, 교통 규칙을 준수하겠습니다.
            </p>
            <p style={{ marginBottom: '12px' }}>
              하나, 양림마을의 문화재와 주민들을 존중하겠습니다.
            </p>
            <p>
              하나, 이 여정을 통해 하나님의 사랑을 느끼겠습니다.
            </p>
          </div>
        </div>

        {/* Agreement checkbox */}
        <div
          onClick={() => setAgreed(!agreed)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px',
            background: agreed ? 'rgba(212,168,83,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${agreed ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '12px', cursor: 'pointer',
            marginBottom: '20px',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px',
            border: `2px solid ${agreed ? '#d4a853' : 'rgba(255,255,255,0.2)'}`,
            background: agreed ? '#d4a853' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}>
            {agreed && <span style={{ color: '#0a0a0f', fontSize: '13px', fontWeight: '700' }}>✓</span>}
          </div>
          <span style={{
            fontSize: '14px', color: 'rgba(255,255,255,0.7)',
            fontWeight: '600', fontFamily: "'Noto Serif KR', serif",
          }}>
            위 서약에 동의합니다
          </span>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!agreed || submitting || !isConnected}
          style={{
            width: '100%',
            padding: '16px',
            background: agreed && !submitting ? '#d4a853' : 'rgba(255,255,255,0.06)',
            color: agreed && !submitting ? '#0a0a0f' : 'rgba(255,255,255,0.25)',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: agreed && !submitting ? 'pointer' : 'not-allowed',
            fontFamily: "'Noto Serif KR', serif",
            letterSpacing: '0.02em',
            transition: 'all 0.2s ease',
          }}
        >
          {submitting ? '처리 중...' : '서약하고 게임 시작'}
        </button>

        {/* Connection status */}
        <div style={{
          textAlign: 'center', marginTop: '16px',
          fontSize: '11px', color: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isConnected ? '#6fea8d' : '#ef4444',
            display: 'inline-block',
          }} />
          {isConnected ? '서버 연결됨' : '서버 연결 중...'}
        </div>
      </motion.div>
    </div>
  )
}
