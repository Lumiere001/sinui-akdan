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
      color: '#fff',
      fontFamily: "'Noto Serif KR', serif",
      padding: '32px 24px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <motion.div
        style={{ width: '100%', maxWidth: '390px', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#6fea8d', marginBottom: 4 }}>
            악단 입단 서약서
          </h1>
          <p style={{ fontSize: 12, color: '#666' }}>
            신의 악단에 입단하기 위한 서약
          </p>
        </div>

        {/* Pledge box */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, marginBottom: 16 }}>
            나는 오늘, <span style={{ color: '#6fea8d', fontWeight: 600 }}>신의 악단</span>의 일원이 되어
            잃어버린 악보를 되찾기 위한 신성한 임무에 참여합니다.
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0' }} />

          {[
            { text: <>나는 주어진 임무에 <span style={{ color: '#6fea8d' }}>최선을 다해 참여</span>할 것을 서약합니다.</> },
            { text: <>탐색 중 발견한 물건이나 시설물을 <span style={{ color: '#f59e0b' }}>절대 만지거나 훼손하지 않을 것</span>을 서약합니다.</> },
            { text: <>이 임무에서 보고 들은 모든 것을 <span style={{ color: '#f59e0b' }}>외부에 발설하지 않을 것</span>을 서약합니다. 악보의 비밀은 악단 안에서만 지켜져야 합니다.</> },
            { text: <>동료 악단원들과 <span style={{ color: '#6fea8d' }}>협력하여</span> 임무를 완수할 것을 서약합니다.</> },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
              <span style={{ color: '#6fea8d', fontWeight: 700, fontSize: 14, minWidth: 20 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: '#bbb', lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Agreement checkbox */}
        <div
          onClick={() => setAgreed(!agreed)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 20, cursor: 'pointer',
          }}
        >
          <div style={{
            flex: 1, padding: 12,
            background: 'rgba(255,255,255,0.03)',
            border: `1px dashed ${agreed ? 'rgba(111,234,141,0.5)' : 'rgba(111,234,141,0.3)'}`,
            borderRadius: 8, textAlign: 'center',
            color: '#6fea8d', fontSize: 13,
          }}>
            ✍️ 서약에 동의합니다
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!agreed || submitting || !isConnected}
          style={{
            width: '100%',
            padding: 14,
            background: agreed && !submitting ? '#6fea8d' : 'rgba(255,255,255,0.06)',
            color: agreed && !submitting ? '#0a0a0f' : 'rgba(255,255,255,0.25)',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: agreed && !submitting ? 'pointer' : 'not-allowed',
            fontFamily: "'Noto Serif KR', serif",
            transition: 'all 0.2s ease',
          }}
        >
          {submitting ? '처리 중...' : '입단 서약 완료'}
        </button>

        {/* Connection status */}
        <div style={{
          textAlign: 'center', marginTop: 16,
          fontSize: 11, color: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isConnected ? '#6fea8d' : '#ef4444',
            display: 'inline-block',
          }} />
          {isConnected ? '서버 연결됨' : '서버 연결 중...'}
        </div>
      </motion.div>
    </div>
  )
}
