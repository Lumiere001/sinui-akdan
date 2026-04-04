import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react'

export function Result() {
  const { type } = useParams<{ type: 'correct' | 'wrong' }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [displayPhoto, setDisplayPhoto] = useState<string | null>(null)
  const state = location.state as { photoUrl?: string }

  useEffect(() => {
    if (type === 'correct' && state?.photoUrl) {
      setDisplayPhoto(state.photoUrl)
    }
  }, [type, state])

  const isCorrect = type === 'correct'

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 16 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  }

  return (
    <motion.div
      className="noise flex flex-col items-center justify-center min-h-screen w-full px-5 relative overflow-hidden"
      style={{
        background: isCorrect
          ? 'radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.08) 0%, #0a0f1e 60%)'
          : 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.08) 0%, #0a0f1e 60%)',
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{
            background: `radial-gradient(circle, ${isCorrect ? '#10b981' : '#ef4444'} 0%, transparent 70%)`,
            left: '50%',
            top: '20%',
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Floating notes for correct */}
      {isCorrect && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['♪', '♫', '♩', '♬', '♪'].map((note, idx) => (
            <motion.div
              key={idx}
              className="absolute text-emerald-400/[0.08] select-none"
              style={{
                fontSize: `${24 + idx * 6}px`,
                left: `${10 + idx * 18}%`,
                top: `${15 + idx * 12}%`,
              }}
              animate={{
                y: [0, -40 - idx * 8, 0],
                opacity: [0.08, 0.15, 0.08],
              }}
              transition={{ duration: 4 + idx, repeat: Infinity, ease: 'easeInOut' }}
            >
              {note}
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        className="z-10 text-center w-full max-w-sm space-y-6"
        variants={containerVariants}
      >
        {/* Icon */}
        <motion.div variants={itemVariants} className="flex justify-center">
          {isCorrect ? (
            <motion.div
              className={`w-24 h-24 rounded-3xl flex items-center justify-center glow-emerald`}
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div
              className={`w-24 h-24 rounded-3xl flex items-center justify-center glow-red`}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              animate={{ x: [0, -6, 6, -6, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <XCircle className="w-12 h-12 text-red-400" />
            </motion.div>
          )}
        </motion.div>

        {/* Main message */}
        <motion.div variants={itemVariants}>
          <h1 className={`text-3xl font-extrabold mb-2 ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
            {isCorrect ? '축하합니다!' : '오답입니다'}
          </h1>
          <p className="text-sm text-gray-400">
            {isCorrect ? '올바른 장소를 찾으셨습니다' : '다른 장소를 찾아보세요'}
          </p>
        </motion.div>

        {/* Photo display for correct answer */}
        {isCorrect && displayPhoto && (
          <motion.div
            variants={itemVariants}
            className="w-full aspect-[4/3] rounded-2xl overflow-hidden glow-emerald"
            style={{ border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <img
              src={displayPhoto}
              alt="악보 마디"
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* Musical celebration */}
        {isCorrect && (
          <motion.div variants={itemVariants} className="flex justify-center gap-3">
            {['♪', '♫', '♩', '♫', '♪'].map((note, i) => (
              <motion.div
                key={i}
                className="text-2xl text-emerald-400/60"
                animate={{ y: [0, -12, 0] }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              >
                {note}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div variants={itemVariants} className="space-y-3 pt-2">
          <motion.button
            onClick={() => navigate('/game')}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              isCorrect
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white glow-emerald hover:shadow-xl'
                : 'bg-gradient-to-r from-red-500 to-red-400 text-white glow-red hover:shadow-xl'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isCorrect ? '다음 장소 찾기' : '다시 시도'}
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <motion.button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl font-semibold text-xs text-gray-400 glass hover:text-white hover:bg-white/[0.04] transition-all flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Home className="w-3.5 h-3.5" />
            홈으로 돌아가기
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
