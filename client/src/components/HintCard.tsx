import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface HintCardProps {
  hint: string
}

export function HintCard({ hint }: HintCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      className="w-full bg-gradient-to-br from-amber-900/30 to-amber-950/20 border border-amber-700/40 rounded-lg p-6 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
      whileHover={{ borderColor: '#b4860c' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">♪</span>
          <h3 className="text-lg font-semibold text-amber-100">힌트</h3>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-amber-300" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-amber-700/40"
          >
            <p className="text-amber-50 leading-relaxed text-sm">{hint}</p>
            <div className="flex justify-around mt-3 text-xs text-amber-300/60">
              <span>♪</span>
              <span>♪</span>
              <span>♪</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
