import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { validateTeamLogin } from '../data/gameData'

export function Landing() {
  const navigate = useNavigate()
  const [teamInput, setTeamInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isRepresentative, setIsRepresentative] = useState(false)
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)

  const handleLogin = () => {
    const teamNum = parseInt(teamInput, 10)
    if (!teamNum || teamNum < 1 || teamNum > 11) {
      setError('팀 번호를 확인해주세요 (1-11)')
      return
    }
    if (!nameInput.trim()) {
      setError('이름을 입력해주세요')
      return
    }
    if (!validateTeamLogin(teamNum, passwordInput)) {
      setError('비밀번호가 올바르지 않습니다')
      return
    }
    setError('')
    localStorage.setItem('teamId', teamNum.toString())
    localStorage.setItem('teamPassword', passwordInput)
    localStorage.setItem('playerName', nameInput.trim())
    localStorage.setItem('isRepresentative', isRepresentative ? 'true' : 'false')
    // Generate deterministic playerId from team + name
    // This ensures the same person gets the same ID regardless of browser/app
    const pid = `t${teamNum}_${nameInput.trim()}`
    localStorage.setItem('playerId', pid)
    navigate('/pledge')
  }

  const canSubmit = teamInput && passwordInput && nameInput.trim()

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
        style={{ width: '100%', maxWidth: '340px' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', marginBottom: '20px',
          }}>
            🎼
          </div>

          <h1 style={{
            fontSize: '24px', fontWeight: '700',
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.02em', marginBottom: '8px',
            fontFamily: "'Noto Serif KR', serif",
          }}>
            신의 악단
          </h1>
          <p style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}>
            God's Orchestra
          </p>
        </div>

        {/* Description */}
        <p style={{
          textAlign: 'center', fontSize: '14px',
          color: 'rgba(255,255,255,0.4)', lineHeight: 1.7,
          marginBottom: '32px',
          fontFamily: "'Noto Serif KR', serif",
        }}>
          양림동의 숨겨진 장소들을 찾아<br />하나님의 악보를 완성하세요
        </p>

        {/* Rules toggle */}
        <div style={{ marginBottom: '28px' }}>
          <button
            onClick={() => setShowRules(!showRules)}
            style={{
              width: '100%', padding: '14px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600',
              fontFamily: "'Noto Serif KR', serif",
              transition: 'all 0.2s',
            }}
          >
            <span>게임 규칙 안내</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              {showRules ? '▲' : '▼'}
            </span>
          </button>

          <AnimatePresence>
            {showRules && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: '8px', padding: '18px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}>
                  {[
                    { icon: '📍', title: '장소 찾기', desc: '힌트를 읽고 3개의 장소를 순서대로 찾아가세요. 각 단계마다 2곳 중 정답 장소를 골라야 합니다.' },
                    { icon: '⏱', title: '제한 시간', desc: '30분 안에 3개의 장소를 모두 찾으면 악보 조각을 획득합니다.' },
                    { icon: '👥', title: '팀 협동', desc: '팀원 3명 이상이 정답 장소 근처(50m)에 모여야 해금됩니다. 함께 움직이세요!' },
                  ].map((rule, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      marginBottom: i < 2 ? '16px' : 0,
                    }}>
                      <span style={{ fontSize: '18px', marginTop: '2px' }}>{rule.icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', fontFamily: "'Noto Serif KR', serif" }}>
                          {rule.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, fontFamily: "'Noto Serif KR', serif" }}>
                          {rule.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Login form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{
              display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600',
              marginBottom: '8px',
              fontFamily: "'Noto Serif KR', serif",
            }}>
              이름
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setError('') }}
              placeholder="이름을 입력하세요"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', color: 'rgba(255,255,255,0.9)',
                fontSize: '15px', fontFamily: "'Noto Serif KR', serif",
                outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600',
              marginBottom: '8px',
              fontFamily: "'Noto Serif KR', serif",
            }}>
              팀 번호
            </label>
            <input
              type="number" min="1" max="10" inputMode="numeric"
              value={teamInput}
              onChange={(e) => { setTeamInput(e.target.value); setError('') }}
              placeholder="1 - 10"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', color: 'rgba(255,255,255,0.9)',
                fontSize: '15px', fontFamily: "'Noto Serif KR', serif",
                outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600',
              marginBottom: '8px',
              fontFamily: "'Noto Serif KR', serif",
            }}>
              비밀번호
            </label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="4자리 숫자"
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', color: 'rgba(255,255,255,0.9)',
                fontSize: '15px', fontFamily: "'Noto Serif KR', serif",
                outline: 'none', transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Representative checkbox */}
          <div
            onClick={() => setIsRepresentative(!isRepresentative)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px',
              background: isRepresentative ? 'rgba(111,234,141,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isRepresentative ? 'rgba(111,234,141,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '12px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: '20px', height: '20px', borderRadius: '6px',
              border: `2px solid ${isRepresentative ? '#6fea8d' : 'rgba(255,255,255,0.2)'}`,
              background: isRepresentative ? '#6fea8d' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              {isRepresentative && <span style={{ color: '#0a0a0f', fontSize: '12px', fontWeight: '700' }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontFamily: "'Noto Serif KR', serif" }}>
                팀 대표로 참가
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', fontFamily: "'Noto Serif KR', serif" }}>
                팀 대표만 관리자와 채팅할 수 있습니다
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                padding: '12px 16px', borderRadius: '10px',
                background: 'rgba(255, 100, 100, 0.08)',
                border: '1px solid rgba(255, 100, 100, 0.15)',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#ff6b6b', fontFamily: "'Noto Serif KR', serif" }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '16px',
            background: canSubmit ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.06)',
            color: canSubmit ? '#0a0a0f' : 'rgba(255,255,255,0.25)',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: "'Noto Serif KR', serif",
            letterSpacing: '0.02em',
            transition: 'all 0.2s ease',
          }}
        >
          {canSubmit ? '입장하기' : '정보를 입력하세요'}
        </button>

        {/* Footer */}
        <p style={{
          textAlign: 'center', fontSize: '11px',
          color: 'rgba(255,255,255,0.2)', marginTop: '24px',
          fontFamily: "'Noto Serif KR', serif",
        }}>
          광주 CCC · 양림동 미션
        </p>
      </motion.div>
    </div>
  )
}
