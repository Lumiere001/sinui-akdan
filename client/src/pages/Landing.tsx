import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { validateTeamLogin, getTeamName } from '../data/gameData'
import { useSocket } from '../hooks/useSocket'
import { colors, typography, spacing, radius, shadows, transitions } from '../theme'

/**
 * 카카오톡 인앱 브라우저 감지
 *
 * - Android: intent:// 스킴으로 Chrome 자동 실행 (사용자 탭으로 이동)
 * - iOS: 자동 리다이렉트 불가능(Safari로 강제 이동할 방법이 없음) →
 *        안내 화면만 표시하고, 사용자가 카카오톡 메뉴(⋯)에서 직접 Safari로 열도록 유도.
 *        과거에 window.location.href = currentUrl 으로 리다이렉트를 시도했으나
 *        iOS 카카오 인앱에서는 같은 URL로 재로드 → useEffect 재실행 → 무한 루프 발생.
 */
function useKakaoInAppRedirect() {
  const [isKakao, setIsKakao] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (!/KAKAOTALK/i.test(ua)) return

    setIsKakao(true)

    // Android만 자동 리다이렉트. iOS는 안내 화면만 표시.
    if (/android/i.test(ua)) {
      const currentUrl = window.location.href
      window.location.href =
        'intent://' +
        currentUrl.replace(/^https?:\/\//, '') +
        '#Intent;scheme=https;package=com.android.chrome;end'
    }
  }, [])

  return isKakao
}

export function Landing() {
  const navigate = useNavigate()
  const { socket, isConnected } = useSocket()
  const isKakaoInApp = useKakaoInAppRedirect()
  const [teamInput, setTeamInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isRepresentative, setIsRepresentative] = useState(false)
  const [pledgeAgreed, setPledgeAgreed] = useState(false)
  const [showPledge, setShowPledge] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = () => {
    const teamNum = parseInt(teamInput, 10)
    if (!teamNum || teamNum < 1 || teamNum > 10) {
      setError('팀 번호를 확인해주세요 (1-10)')
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
    if (!pledgeAgreed) {
      setError('서약에 동의해주세요')
      return
    }
    setError('')
    localStorage.setItem('teamId', teamNum.toString())
    localStorage.setItem('teamPassword', passwordInput)
    localStorage.setItem('playerName', nameInput.trim())
    localStorage.setItem('isRepresentative', isRepresentative ? 'true' : 'false')
    const pid = `t${teamNum}_${nameInput.trim()}`
    localStorage.setItem('playerId', pid)

    // Submit pledge via socket
    if (socket && isConnected) {
      socket.emit('player:join', {
        teamId: teamNum, playerId: pid, playerName: nameInput.trim(),
        password: passwordInput, isRepresentative,
      })
      socket.emit('pledge:submit', { playerId: pid, teamId: teamNum })
    }
    navigate('/game')
  }

  const canSubmit = teamInput && passwordInput && nameInput.trim() && pledgeAgreed

  // 카카오톡 인앱 브라우저일 경우 외부 브라우저 안내 화면 표시
  if (isKakaoInApp) {
    const currentUrl = window.location.href
    const ua = navigator.userAgent || ''
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isAndroid = /android/i.test(ua)

    const handleCopyUrl = () => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(currentUrl)
          .then(() => alert('주소가 복사되었습니다.\nSafari를 열고 주소창에 붙여넣기 해주세요.'))
          .catch(() => alert('주소 복사에 실패했습니다.\n주소를 길게 눌러 직접 복사해주세요.'))
      } else {
        alert('주소 복사 기능을 사용할 수 없습니다.\n주소를 길게 눌러 직접 복사해주세요.')
      }
    }

    const handleOpenAndroidChrome = () => {
      window.location.href =
        'intent://' +
        currentUrl.replace(/^https?:\/\//, '') +
        '#Intent;scheme=https;package=com.android.chrome;end'
    }

    return (
      <div style={{
        minHeight: '100vh', background: colors.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: `${spacing.xxl}px ${spacing.xl}px`,
        fontFamily: typography.fontFamily,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🌐</div>
          <h2 style={{ color: colors.textPrimary, fontSize: typography.lg, fontWeight: typography.bold, marginBottom: spacing.md }}>
            외부 브라우저에서 열어주세요
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: typography.base, lineHeight: 1.7, marginBottom: spacing.xxl }}>
            카카오톡 브라우저에서는 위치 서비스 등<br />
            일부 기능이 제한됩니다.<br />
            {isIOS ? (
              <><span style={{ color: colors.accent }}>Safari</span>에서 열어주세요.</>
            ) : (
              <><span style={{ color: colors.accent }}>Chrome</span> 또는 <span style={{ color: colors.accent }}>Safari</span>에서 열어주세요.</>
            )}
          </p>

          {/* iOS: 수동 안내 (자동 리다이렉트 불가 — 과거 루프 버그 회피) */}
          {isIOS && (
            <div style={{
              padding: `${spacing.lg}px`,
              borderRadius: radius.md,
              background: colors.surface,
              border: `1px solid ${colors.accentBorder}`,
              marginBottom: spacing.lg,
              textAlign: 'left',
            }}>
              <div style={{
                fontSize: typography.sm, color: colors.accent,
                fontWeight: typography.bold, marginBottom: spacing.sm,
                textAlign: 'center',
              }}>
                Safari로 여는 방법
              </div>
              <div style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.8 }}>
                <div style={{ marginBottom: spacing.xs }}>
                  <span style={{ color: colors.accent, fontWeight: typography.bold }}>1.</span> 화면 오른쪽 아래 <span style={{ color: colors.accent }}>⋯</span> (더보기) 버튼 탭
                </div>
                <div style={{ marginBottom: spacing.xs }}>
                  <span style={{ color: colors.accent, fontWeight: typography.bold }}>2.</span> <span style={{ color: colors.accent }}>'Safari로 열기'</span> 선택
                </div>
                <div>
                  <span style={{ color: colors.accent, fontWeight: typography.bold }}>3.</span> 또는 아래 주소를 복사해서 Safari에 붙여넣기
                </div>
              </div>
            </div>
          )}

          {/* Android: Chrome 직접 열기 버튼 */}
          {isAndroid && (
            <button
              onClick={handleOpenAndroidChrome}
              style={{
                width: '100%', padding: spacing.lg,
                borderRadius: radius.pill,
                background: colors.accent, color: colors.bg,
                fontSize: typography.md, fontWeight: typography.bold,
                border: 'none', cursor: 'pointer', marginBottom: spacing.md,
                fontFamily: typography.fontFamily,
                letterSpacing: typography.wide,
                textTransform: 'uppercase' as const,
              }}
            >
              Chrome으로 열기
            </button>
          )}

          {/* 주소 복사 버튼 (iOS/Android 공통) */}
          <button
            onClick={handleCopyUrl}
            style={{
              width: '100%', padding: spacing.lg,
              borderRadius: radius.pill,
              background: isIOS ? colors.accent : colors.surfaceLight,
              color: isIOS ? colors.bg : colors.textPrimary,
              fontSize: typography.md, fontWeight: typography.bold,
              border: isIOS ? 'none' : `1px solid ${colors.border}`,
              cursor: 'pointer', marginBottom: spacing.md,
              fontFamily: typography.fontFamily,
              letterSpacing: typography.wide,
            }}
          >
            주소 복사하기
          </button>

          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radius.md,
            background: colors.surface,
            border: `1px solid ${colors.borderLight}`,
          }}>
            <div style={{ fontSize: typography.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
              주소를 길게 눌러 복사할 수도 있어요
            </div>
            <div style={{
              fontSize: typography.sm, color: colors.textSecondary,
              fontFamily: typography.monoFamily,
              wordBreak: 'break-all', lineHeight: 1.5,
              userSelect: 'all' as const,
            }}>
              {currentUrl}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing.xxl}px ${spacing.xl}px`,
    }}>
      <motion.div
        style={{ width: '100%', maxWidth: '360px' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{
            width: 72, height: 72, borderRadius: radius.full,
            background: colors.accent,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: spacing.xl,
            boxShadow: shadows.accent,
          }}>
            🎼
          </div>

          <h1 style={{
            fontSize: typography.xl, fontWeight: typography.bold,
            color: colors.textPrimary,
            letterSpacing: typography.tight, marginBottom: spacing.sm,
            fontFamily: typography.fontFamily,
          }}>
            신의 악단
          </h1>
          <p style={{
            fontSize: typography.xs, color: colors.textMuted,
            letterSpacing: typography.label, textTransform: 'uppercase',
            fontFamily: typography.monoFamily,
          }}>
            God's Orchestra
          </p>
        </div>

        {/* Description */}
        <p style={{
          textAlign: 'center', fontSize: typography.base,
          color: colors.textSecondary, lineHeight: 1.7,
          marginBottom: spacing.xxl,
          fontFamily: typography.fontFamily,
        }}>
          양림동의 숨겨진 장소들을 찾아<br />하나님의 악보를 완성하세요
        </p>

        {/* Pledge (서약서) */}
        <div style={{ marginBottom: spacing.xl }}>
          <button
            onClick={() => setShowPledge(!showPledge)}
            style={{
              width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
              background: pledgeAgreed ? colors.accentMuted : colors.surface,
              border: `1px solid ${pledgeAgreed ? colors.accentBorder : colors.borderLight}`,
              borderRadius: radius.md, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: pledgeAgreed ? colors.accent : colors.textSecondary,
              fontSize: typography.base,
              fontWeight: typography.semibold,
              fontFamily: typography.fontFamily,
              transition: transitions.normal,
            }}
          >
            <span>📜 악단 입단 서약서 {pledgeAgreed ? '✓' : ''}</span>
            <span style={{ fontSize: typography.sm, color: colors.textMuted }}>
              {showPledge ? '▲' : '▼'}
            </span>
          </button>

          <AnimatePresence>
            {showPledge && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: spacing.sm, padding: `${spacing.lg}px`,
                  background: colors.surface,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: radius.md,
                }}>
                  <div style={{
                    fontSize: typography.sm, color: colors.textSecondary,
                    lineHeight: 1.8, marginBottom: spacing.lg,
                    fontFamily: typography.fontFamily,
                  }}>
                    나는 오늘, <span style={{ color: colors.accent, fontWeight: typography.semibold }}>신의 악단</span>의 일원이 되어
                    잃어버린 악보를 되찾기 위한 신성한 임무에 참여합니다.
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.borderLight}`, margin: `${spacing.lg}px 0` }} />

                  {[
                    { text: <>나는 주어진 임무에 <span style={{ color: colors.accent }}>최선을 다해 참여</span>할 것을 서약합니다.</> },
                    { text: <>탐색 중 발견한 물건이나 시설물을 <span style={{ color: colors.warning }}>절대 만지거나 훼손하지 않을 것</span>을 서약합니다.</> },
                    { text: <>이 임무에서 보고 들은 모든 것을 <span style={{ color: colors.warning }}>외부에 발설하지 않을 것</span>을 서약합니다. 악보의 비밀은 악단 안에서만 지켜져야 합니다.</> },
                    { text: <>동료 악단원들과 <span style={{ color: colors.accent }}>협력하여</span> 임무를 완수할 것을 서약합니다.</> },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: spacing.md, marginBottom: spacing.md,
                      alignItems: 'flex-start',
                    }}>
                      <span style={{ color: colors.accent, fontWeight: typography.bold, fontSize: typography.base, minWidth: 20 }}>{i + 1}</span>
                      <span style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6, fontFamily: typography.fontFamily }}>{item.text}</span>
                    </div>
                  ))}

                  {/* Agree checkbox inside pledge box */}
                  <div style={{ borderTop: `1px solid ${colors.borderLight}`, margin: `${spacing.lg}px 0` }} />
                  <div
                    onClick={() => setPledgeAgreed(!pledgeAgreed)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing.sm,
                      cursor: 'pointer', padding: `${spacing.sm}px 0`,
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: radius.sm,
                      border: `2px solid ${pledgeAgreed ? colors.accent : colors.textMuted}`,
                      background: pledgeAgreed ? colors.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: transitions.normal, flexShrink: 0,
                    }}>
                      {pledgeAgreed && <span style={{ color: colors.bg, fontSize: typography.sm, fontWeight: typography.bold }}>✓</span>}
                    </div>
                    <span style={{
                      fontSize: typography.sm, fontFamily: typography.fontFamily,
                      color: pledgeAgreed ? colors.accent : colors.textSecondary,
                    }}>
                      위 서약에 동의합니다
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Login form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.lg }}>
          {/* 이름 */}
          <div>
            <label style={{
              display: 'block', fontSize: typography.xs, color: colors.textMuted,
              textTransform: 'uppercase', letterSpacing: typography.wider,
              fontWeight: typography.semibold, marginBottom: spacing.sm,
              fontFamily: typography.fontFamily,
            }}>이름</label>
            <input
              type="text"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setError('') }}
              placeholder="이름을 입력하세요"
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
                background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                borderRadius: radius.md, color: colors.textPrimary,
                fontSize: typography.base, fontFamily: typography.fontFamily,
                outline: 'none', transition: transitions.normal, boxSizing: 'border-box' as const,
              }}
              onFocus={e => e.currentTarget.style.borderColor = colors.accent}
              onBlur={e => e.currentTarget.style.borderColor = colors.border as string}
            />
          </div>

          {/* 팀 선택 (드롭다운) */}
          <div>
            <label style={{
              display: 'block', fontSize: typography.xs, color: colors.textMuted,
              textTransform: 'uppercase', letterSpacing: typography.wider,
              fontWeight: typography.semibold, marginBottom: spacing.sm,
              fontFamily: typography.fontFamily,
            }}>팀 선택</label>
            <select
              value={teamInput}
              onChange={e => { setTeamInput(e.target.value); setError('') }}
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
                background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                borderRadius: radius.md, color: teamInput ? colors.textPrimary : colors.textMuted,
                fontSize: typography.base, fontFamily: typography.fontFamily,
                outline: 'none', transition: transitions.normal, boxSizing: 'border-box' as const,
                appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '16px',
              }}
              onFocus={e => e.currentTarget.style.borderColor = colors.accent}
              onBlur={e => e.currentTarget.style.borderColor = colors.border as string}
            >
              <option value="" disabled>팀을 선택하세요</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(t => (
                <option key={t} value={String(t)} style={{ color: colors.textPrimary, background: colors.bg }}>
                  {t}. {getTeamName(t)}
                </option>
              ))}
            </select>
          </div>

          {/* 비밀번호 */}
          <div>
            <label style={{
              display: 'block', fontSize: typography.xs, color: colors.textMuted,
              textTransform: 'uppercase', letterSpacing: typography.wider,
              fontWeight: typography.semibold, marginBottom: spacing.sm,
              fontFamily: typography.fontFamily,
            }}>비밀번호</label>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="4자리 숫자"
              inputMode="numeric"
              maxLength={4}
              style={{
                width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
                background: colors.surfaceLight, border: `1px solid ${colors.border}`,
                borderRadius: radius.md, color: colors.textPrimary,
                fontSize: typography.base, fontFamily: typography.fontFamily,
                outline: 'none', transition: transitions.normal, boxSizing: 'border-box' as const,
              }}
              onFocus={e => e.currentTarget.style.borderColor = colors.accent}
              onBlur={e => e.currentTarget.style.borderColor = colors.border as string}
            />
          </div>

          {/* Representative checkbox */}
          <div
            onClick={() => setIsRepresentative(!isRepresentative)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.md,
              padding: `${spacing.md}px ${spacing.lg}px`,
              background: isRepresentative ? colors.accentMuted : colors.surface,
              border: `1px solid ${isRepresentative ? colors.accentBorder : colors.borderLight}`,
              borderRadius: radius.md, cursor: 'pointer',
              transition: transitions.normal,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: radius.sm,
              border: `2px solid ${isRepresentative ? colors.accent : colors.textMuted}`,
              background: isRepresentative ? colors.accent : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: transitions.normal,
              flexShrink: 0,
            }}>
              {isRepresentative && <span style={{ color: colors.bg, fontSize: typography.sm, fontWeight: typography.bold }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.semibold, fontFamily: typography.fontFamily }}>
                팀 대표로 참가
              </div>
              <div style={{ fontSize: typography.xs, color: colors.textMuted, marginTop: 2, fontFamily: typography.fontFamily }}>
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
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                background: colors.errorBg,
                border: `1px solid ${colors.errorBorder}`,
                marginBottom: spacing.lg,
              }}
            >
              <span style={{ fontSize: typography.sm, color: colors.error, fontFamily: typography.fontFamily }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login button - Spotify pill style */}
        <button
          onClick={handleLogin}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: `${spacing.lg}px`,
            background: canSubmit ? colors.accent : colors.surfaceLight,
            color: canSubmit ? colors.bg : colors.textDisabled,
            border: 'none',
            borderRadius: radius.pill,
            fontSize: typography.md,
            fontWeight: typography.bold,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: typography.fontFamily,
            letterSpacing: typography.wide,
            transition: transitions.normal,
            boxShadow: canSubmit ? shadows.accent : 'none',
          }}
        >
          {canSubmit ? '서약 완료 · 입장하기' : !pledgeAgreed && teamInput && passwordInput && nameInput.trim() ? '서약에 동의해주세요' : '정보를 입력하세요'}
        </button>

        {/* Footer */}
        <p style={{
          textAlign: 'center', fontSize: typography.xs,
          color: colors.textDisabled, marginTop: spacing.xl,
          fontFamily: typography.fontFamily,
        }}>
          광주 CCC · 양림동 미션
        </p>
      </motion.div>
    </div>
  )
}
