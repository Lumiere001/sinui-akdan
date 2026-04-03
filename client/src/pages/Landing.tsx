import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Music } from 'lucide-react'

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
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen w-full px-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Musical notes background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute text-gold/10 text-6xl"
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ left: '10%', top: '10%' }}
        >
          ♪
        </motion.div>
        <motion.div
          className="absolute text-gold/10 text-4xl"
          animate={{ y: [0, 30, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ right: '15%', top: '20%' }}
        >
          ♫
        </motion.div>
        <motion.div
          className="absolute text-gold/10 text-5xl"
          animate={{ y: [0, -25, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
          style={{ left: '20%', bottom: '15%' }}
        >
          ♪
        </motion.div>
      </div>

      <motion.div
        className="z-10 text-center space-y-8 max-w-md"
        variants={containerVariants}
      >
        {/* Icon */}
        <motion.div variants={itemVariants} className="flex justify-center">
          <Music className="w-16 h-16 text-gold" />
        </motion.div>

        {/* Title */}
        <motion.div variants={itemVariants}>
          <h1 className="text-5xl font-bold text-white mb-2">신의 악단</h1>
          <p className="text-gold text-sm font-medium tracking-widest">GOD'S ORCHESTRA</p>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-gray-300 text-lg leading-relaxed font-light"
        >
          펭귄마을의 숨겨진 장소들을 찾아 악보를 완성하세요
        </motion.p>

        {/* Team selection */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-4 tracking-wide">팀 번호를 선택하세요</label>

            {/* Grid of team buttons */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <motion.button
                  key={num}
                  onClick={() => handleSelectTeam(num)}
                  className={`py-3 rounded-lg font-bold text-sm transition-all ${
                    teamId === num
                      ? 'bg-gold text-slate-900 shadow-lg shadow-gold/50'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {num}
                </motion.button>
              ))}
            </div>

            {/* Input field (optional) */}
            <input
              type="number"
              min="1"
              max="10"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="또는 번호 입력"
              className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white placeholder-gray-400 border border-slate-600 focus:border-gold focus:outline-none transition-colors"
            />
          </div>

          {/* Selected team display */}
          {teamId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-4 rounded-lg bg-gold/10 border border-gold/30"
            >
              <p className="text-gold font-semibold">팀 {teamId}</p>
              <p className="text-gray-300 text-sm">선택됨</p>
            </motion.div>
          )}
        </motion.div>

        {/* Enter button */}
        <motion.button
          variants={itemVariants}
          onClick={handleEnter}
          disabled={!teamId}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
            teamId
              ? 'bg-gradient-to-r from-gold to-amber-500 text-slate-900 hover:shadow-lg hover:shadow-gold/50 cursor-pointer'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
          }`}
          whileHover={teamId ? { scale: 1.02 } : {}}
          whileTap={teamId ? { scale: 0.98 } : {}}
        >
          입장하기
        </motion.button>
      </motion.div>

      {/* Bottom decorative element */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gold/5 to-transparent pointer-events-none"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </motion.div>
  )
}
