import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react'

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
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  // Floating musical notes
  const floatingNotes = ['♪', '♫', '♪', '♫']

  return (
    <motion.div
      className={`flex flex-col items-center justify-center min-h-screen w-full px-6 relative overflow-hidden ${
        isCorrect
          ? 'bg-gradient-to-b from-emerald-950 via-slate-900 to-emerald-950'
          : 'bg-gradient-to-b from-red-950 via-slate-900 to-red-950'
      }`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Floating background notes */}
      {floatingNotes.map((note, idx) => (
        <motion.div
          key={idx}
          className={`absolute text-4xl ${isCorrect ? 'text-emerald-400/20' : 'text-red-400/20'}`}
          animate={{
            y: [0, -100, 0],
            x: [Math.random() * 100 - 50, Math.random() * 100 - 50, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 4 + idx,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            left: `${25 * (idx + 1)}%`,
            top: '10%',
          }}
        >
          {note}
        </motion.div>
      ))}

      <motion.div
        className="z-10 text-center space-y-8 max-w-2xl w-full"
        variants={containerVariants}
      >
        {/* Icon */}
        <motion.div variants={itemVariants} className="flex justify-center">
          {isCorrect ? (
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <CheckCircle className="w-24 h-24 text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ x: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <XCircle className="w-24 h-24 text-red-400" />
            </motion.div>
          )}
        </motion.div>

        {/* Main message */}
        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className={`text-5xl font-bold ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
            {isCorrect ? '축하합니다!' : '오답입니다'}
          </h1>
          <p className="text-xl text-gray-300">
            {isCorrect ? '올바른 장소를 찾으셨습니다' : '다른 장소를 찾아보세요'}
          </p>
        </motion.div>

        {/* Photo display for correct answer */}
        {isCorrect && displayPhoto && (
          <motion.div
            variants={itemVariants}
            className="w-full aspect-square rounded-lg overflow-hidden border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20"
          >
            <img
              src={displayPhoto}
              alt="악보 마디 (Score Sheet)"
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* Musical note animations for correct */}
        {isCorrect && (
          <motion.div variants={itemVariants} className="flex justify-center gap-4">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="text-3xl text-emerald-400"
                animate={{ y: [0, -20, 0] }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  repeat: Infinity,
                }}
              >
                ♪
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action button */}
        <motion.button
          variants={itemVariants}
          onClick={() => navigate('/game')}
          className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            isCorrect
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/50'
              : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-lg hover:shadow-red-500/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isCorrect ? '다음 장소 찾기' : '다시 시도'}
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Secondary action */}
        <motion.button
          variants={itemVariants}
          onClick={() => navigate('/')}
          className="w-full py-3 rounded-lg font-semibold text-gray-300 border border-gray-600 hover:border-gray-400 hover:bg-gray-800/50 transition-all"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          홈으로 돌아가기
        </motion.button>
      </motion.div>

      {/* Bottom decorative element */}
      <motion.div
        className={`absolute bottom-0 left-0 right-0 h-32 pointer-events-none ${
          isCorrect
            ? 'bg-gradient-to-t from-emerald-500/10 to-transparent'
            : 'bg-gradient-to-t from-red-500/10 to-transparent'
        }`}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </motion.div>
  )
}
