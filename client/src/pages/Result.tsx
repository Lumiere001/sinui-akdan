import { useNavigate, useParams, useLocation } from 'react-router-dom'

export function Result() {
  const { type } = useParams<{ type: 'correct' | 'wrong' }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { photoUrl?: string } | null
  const isCorrect = type === 'correct'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: "'Noto Serif KR', serif",
    }}>
      {/* 아이콘 */}
      <div style={{
        width: 80, height: 80, borderRadius: 20, marginBottom: 24,
        background: isCorrect ? 'rgba(111,234,141,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isCorrect ? 'rgba(111,234,141,0.2)' : 'rgba(239,68,68,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        {isCorrect ? '🎵' : '✕'}
      </div>

      {/* 메시지 */}
      <h1 style={{
        fontSize: 28, fontWeight: 700, marginBottom: 8,
        color: isCorrect ? '#6fea8d' : '#f87171',
      }}>
        {isCorrect ? '축하합니다!' : '오답입니다'}
      </h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 28 }}>
        {isCorrect ? '올바른 장소를 찾으셨습니다' : '다른 장소를 찾아보세요'}
      </p>

      {/* 악보 사진 */}
      {state?.photoUrl && (
        <div style={{
          width: '100%', maxWidth: 320, aspectRatio: '4/3', borderRadius: 12,
          overflow: 'hidden', marginBottom: 24,
          border: `1px solid ${isCorrect ? 'rgba(111,234,141,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <img src={state.photoUrl} alt={isCorrect ? '악보 조각' : '오답'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* 음표 애니메이션 (CSS로 처리) */}
      {isCorrect && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, fontSize: 24, color: 'rgba(111,234,141,0.5)' }}>
          {'♪♫♩♫♪'.split('').map((note, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.1}s` }}>{note}</span>
          ))}
        </div>
      )}

      {/* 버튼 */}
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => navigate('/game')}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: isCorrect ? '#6fea8d' : 'rgba(239,68,68,0.8)',
            color: '#0a0a0f', border: 'none', cursor: 'pointer',
            fontFamily: "'Noto Serif KR', serif",
          }}
        >
          {isCorrect ? '게임으로 돌아가기' : '다시 시도'}
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, fontSize: 13,
            background: 'transparent', color: '#888',
            border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
            fontFamily: "'Noto Serif KR', serif",
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
