import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface HintCardProps {
  hint: string
}

export function HintCard({ hint }: HintCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        padding: '14px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <div>
            <span style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase' as const, letterSpacing: '0.1em',
              fontWeight: '600',
            }}>
              단서
            </span>
          </div>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              padding: '0 16px 14px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              paddingTop: '12px',
            }}>
              <p style={{
                fontSize: '13px', color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.6, fontFamily: "'Noto Serif KR', serif",
              }}>
                {hint}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
