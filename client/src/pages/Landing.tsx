import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Music, Sparkles } from 'lucide-react'

export function Landing() {
  const navigate = useNavigate()
  const [teamId, setTeamId] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState('')

  const handleSelectTeam = (id: number) => {
    setTeamId(id)
    setInputValue('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const num = parseInt(value, 10)
    if (value === '' || (num >= 1 && num <= 10)) {
      setInputValue(value)
      if (num >= 1 && num <= 10) {
        setTeamId(num)
      }
    }
  }

  const handleEnter = () => {
    if (teamId && teamId >= 1 && teamId <= 10) {
      localStorage.setItem('teamId', teamId.toString())
      localStorage.setItem('playerId', `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      navigate('/game')
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  }

  return (
    <motion.div
      className="noise flex flex-col items-center justify-center min-h-screen w-full px-5 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.08) 0%, #0a0f1e 60%)',
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #d4a853 0%, transparent 70%)',
            left: '-10%',
            top: '-10%',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, #d4a853 0%, transparent 70%)',
            right: '-5%',
            bottom: '10%',
          }}
        />

        {/* Floating music notes */}
        {['♪', '♫', '♩', '♬'].map((note, idx) => (
          <motion.div
            key={idx}
            className="absolute text-amber-400/[0.07] select-none"
            style={{
              fontSize: `${28 + idx * 10}px`,
              left: `${15 + idx * 20}%`,
              top: `${10 + idx * 18}%`,
            }}
            animate={{
              y: [0, -30 - idx * 5, 0],
              opacity: [0.07, 0.12, 0.07],
              rotate: [0, idx % 2 === 0 ? 15 : -15, 0],
            }}
            transition={{ duration: 5 + idx * 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {note}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="z-10 text-center w-full max-w-sm"
        variants={containerVariants}
      >
        {/* Logo area */}
        <motion.div variants={itemVariants} className="mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-gold glow-gold mb-6"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Music className="w-10 h-10 text-amber-400" />
          </motion.div>

          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            <span className="text-gradient-gold">신의 악단</span>
          </h1>
          <p className="text-amber-400/60 text-xs font-semibold tracking-[0.3em] uppercase">
            God's Orchestra
          </p>
        </motion.div>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-gray-400 text-sm leading-relaxed mb-8 px-2"
        >
          펭귄마을의 숨겨진 장소들을 찾아<br />악보를 완성하세요
        </motion.p>

        {/* Team selection */}
        <motion.div variants={itemVariants} className="space-y-5">
          <div>
            <label className="block text-xs text-gray-500 mb-3 font-medium tracking-wide uppercase">
              팀 번호 선택
            </label>

            {/* Grid of team buttons */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <motion.button
                  key={num}
                  onClick={() => handleSelectTeam(num)}
                  className={`relative py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                    teamId === num
                      ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-900 glow-gold'
                      : 'glass hover:bg-white/[0.04] text-gray-300 hover:text-white'
                  }`}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                >
                  {num}
                  {teamId === num && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-amber-300/50"
                      layoutId="teamHighlight"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Input field */}
            <div className="relative">
              <input
                type="number"
                min="1"
                max="10"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="또는 번호 직접 입력 (1-10)"
                className="w-full px-4 py-3 rounded-xl glass text-white placeholder-gray-500 text-sm focus:border-amber-400/30 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-all"
              />
            </div>
          </div>

          {/* Selected team badge */}
          {teamId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl glass-gold"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-semibold text-sm">팀 {teamId} 선택됨</span>
            </motion.div>
          )}
        </motion.div>

        {/* Enter button */}
        <motion.button
          variants={itemVariants}
          onClick={handleEnter}
          disabled={!teamId}
          className={`w-full mt-6 py-4 rounded-xl font-bold text-base transition-all duration-300 ${
            teamId
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-900 glow-gold hover:shadow-amber-400/30 hover:shadow-xl cursor-pointer'
              : 'glass text-gray-600 cursor-not-allowed'
          }`}
          whileHover={teamId ? { scale: 1.02 } : {}}
          whileTap={teamId ? { scale: 0.98 } : {}}
        >
          {teamId ? '입장하기' : '팀을 선택하세요'}
        </motion.button>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="mt-8 text-[11px] text-gray-600"
        >
          광주 CCC · 펭귄마을 미션
        </motion.p>
      </motion.div>
    </motion.div>
  )
}