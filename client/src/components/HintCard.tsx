interface HintCardProps {
  hint: string
}

export function HintCard({ hint }: HintCardProps) {
  return (
    <div
      style={{
        background: 'rgba(111,234,141,0.05)',
        border: '1px solid rgba(111,234,141,0.15)',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      <div style={{
        fontSize: '11px',
        color: '#6fea8d',
        marginBottom: '8px',
        letterSpacing: '1px',
      }}>
        📖 단서
      </div>
      <div style={{
        fontSize: '13px',
        color: '#ddd',
        lineHeight: 1.7,
        fontStyle: 'italic',
        fontFamily: "'Noto Serif KR', serif",
      }}>
        {hint}
      </div>
    </div>
  )
}
