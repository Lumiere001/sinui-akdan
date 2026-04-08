import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { validateTeamLogin } from '../data/gameData'
import { colors, typography, spacing, radius, shadows, transitions } from '../theme'

/**
 * 카카오톡 인앱 브라우저 감지 및 외부 브라우저로 리다이렉트
 */
function useKakaoInAppRedirect() {
  const [isKakao, setIsKakao] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (!/KAKAOTALK/i.test(ua)) return

    setIsKakao(true)

    const currentUrl = window.location.href

    // Android: intent:// 스킴으로 Chrome 열기
    if (/android/i.test(ua)) {
      window.location.href =
        'intent://' +
        currentUrl.replace(/^https?:\/\//, '') +
        '#Intent;scheme=https;package=com.android.chrome;end'
      return
    }

    // iOS: Safari로 열기 위해 카카오 인앱 브라우저 탈출
    if (/iphone|ipad|ipod/i.test(ua)) {
      window.location.href = currentUrl
    }
  }, [])

  return isKakao
}

export function Landing() {
  const navigate = useNavigate()
  const isKakaoInApp = useKakaoInAppRedirect()
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
    const pid = `t${teamNum}_${nameInput.trim()}`
    localStorage.setItem('playerId', pid)
    navigate('/pledge')
  }

  const canSubmit = teamInput && passwordInput && nameInput.trim()

  // 카카오톡 인앱 브라우저일 경우 외부 브라우저 안내 화면 표시
  if (isKakaoInApp) {
    const currentUrl = window.location.href
    const handleOpenExternal = () => {
      const ua = navigator.userAgent || ''
      if (/android/i.test(ua)) {
        window.location.href =
          'intent://' +
          currentUrl.replace(/^https?:\/\//, '') +
          '#Intent;scheme=https;package=com.android.chrome;end'
      } else {
        navigator.clipboard?.writeText(currentUrl)
        alert('주소가 복사되었습니다.\nSafari를 열고 주소창에 붙여넣기 해주세요.')
      }
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
            <span style={{ color: colors.accent }}>Chrome</span> 또는 <span style={{ color: colors.accent }}>Safari</span>에서 열어주세요.
          </p>

          <button
            onClick={handleOpenExternal}
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
            외부 브라우저로 열기
          </button>

          <div style={{
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radius.md,
            background: colors.surface,
            border: `1px solid ${colors.borderLight}`,
          }}>
            <div style={{ fontSize: typography.xs, color: colors.textMuted, marginBottom: spacing.xs }}>
              또는 직접 주소를 복사해서 브라우저에 붙여넣기
            </div>
            <div style={{
              fontSize: typography.sm, color: colors.textSecondary,
              fontFamily: typography.monoFamily,
              wordBreak: 'break-all', lineHeight: 1.5,
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

        {/* Rules toggle */}
        <div style={{ marginBottom: spacing.xl }}>
          <button
            onClick={() => setShowRules(!showRules)}
            style={{
              width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
              background: colors.surface,
              border: `1px solid ${colors.borderLight}`,
              borderRadius: radius.md, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: colors.textSecondary, fontSize: typography.base,
              fontWeight: typography.semibold,
              fontFamily: typography.fontFamily,
              transition: transitions.normal,
            }}
          >
            <span>게임 규칙 안내</span>
            <span style={{ fontSize: typography.sm, color: colors.textMuted }}>
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
                  marginTop: spacing.sm, padding: `${spacing.lg}px`,
                  background: colors.surface,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: radius.md,
                }}>
                  {[
                    { icon: '📍', title: '장소 찾기', desc: '힌트를 읽고 3개의 장소를 순서대로 찾아가세요. 각 단계마다 2곳 중 정답 장소를 골라야 합니다.' },
                    { icon: '⏱', title: '제한 시간', desc: '30분 안에 3개의 장소를 모두 찾으면 악보 조각을 획득합니다.' },
                    { icon: '👥', title: '팀 협동', desc: '팀원 3명 이상이 정답 장소 근처(50m)에 모여야 해금됩니다. 함께 움직이세요!' },
                  ].map((rule, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: spacing.md, alignItems: 'flex-start',
                      marginBottom: i < 2 ? spacing.lg : 0,
                    }}>
                      <span style={{ fontSize: 18, marginTop: 2 }}>{rule.icon}</span>
                      <div>
                        <div style={{
                          fontSize: typography.sm, fontWeight: typography.semibold,
                          color: colors.textPrimary, marginBottom: spacing.xs,
                          fontFamily: typography.fontFamily,
                        }}>
                          {rule.title}
                        </div>
                        <div style={{
                          fontSize: typography.sm, color: colors.textSecondary,
                          lineHeight: 1.6, fontFamily: typography.fontFamily,
                        }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.lg }}>
          {[
            { label: '이름', type: 'text', value: nameInput, onChange: (v: string) => { setNameInput(v); setError('') }, placeholder: '이름을 입력하세요' },
            { label: '팀 번호', type: 'number', value: teamInput, onChange: (v: string) => { setTeamInput(v); setError('') }, placeholder: '1 - 11', extra: { min: '1', max: '11', inputMode: 'numeric' as const } },
            { label: '비밀번호', type: 'password', value: passwordInput, onChange: (v: string) => { setPasswordInput(v); setError('') }, placeholder: '4자리 숫자', extra: { inputMode: 'numeric' as const, maxLength: 4 } },
          ].map((field, i) => (
            <div key={i}>
              <label style={{
                display: 'block', fontSize: typography.xs, color: colors.textMuted,
                textTransform: 'uppercase', letterSpacing: typography.wider,
                fontWeight: typography.semibold, marginBottom: spacing.sm,
                fontFamily: typography.fontFamily,
              }}>
                {field.label}
              </label>
              <input
                type={field.type}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onKeyDown={field.type === 'password' ? (e) => e.key === 'Enter' && handleLogin() : undefined}
                placeholder={field.placeholder}
                {...(field.extra || {})}
                style={{
                  width: '100%', padding: `${spacing.md}px ${spacing.lg}px`,
                  background: colors.surfaceLight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md, color: colors.textPrimary,
                  fontSize: typography.base, fontFamily: typography.fontFamily,
                  outline: 'none', transition: transitions.normal,
                  boxSizing: 'border-box' as const,
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = colors.accent}
                onBlur={(e) => e.currentTarget.style.borderColor = colors.border as string}
              />
            </div>
          ))}

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
          {canSubmit ? '입장하기' : '정보를 입력하세요'}
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
