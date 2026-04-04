import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Lock, AlertCircle, ChevronDown, ChevronUp, MapPin, Clock, Users } from 'lucide-react'
import { getTeamByIdAndPassword } from '../data/gameData'

export function Landing() {
  const navigate = useNavigate()
  const [teamInput, setTeamInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)

  const handleLogin = () => {
    const teamNum = parseInt(teamInput, 10)
    if (!teamNum || teamNum < 1 || teamNum > 10) {
      setError('팀 번호를 확인해주세요 (1-10)')
      return
    }
    const team = getTeamByIdAndPassword(teamNum, passwordInput)
    if (!team) {
      setError('비밀번호가 올바르지 않습니다')
      return
    }
    setError('')
    localStorage.setItem('teamId', team.teamId.toString())
    localStorage.setItem('playerId', `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    navigate('/game')
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  return (
    <motion.div
      className="noise flex flex-col items-center min-h-screen w-full px-5 py-10 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.08) 0%, #0a0f1e 60%)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #d4a853 0%, transparent 70%)', left: '-10%', top: '-10%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #d4a853 0%, transparent 70%)', right: '-5%', bottom: '10%' }} />
        {['♪', '♫', '♩', '♬'].map((note, idx) => (
          <motion.div
            key={idx}
            className="absolute text-amber-400/[0.07] select-none"
            style={{ fontSize: `${28 + idx * 10}px`, left: `${15 + idx * 20}%`, top: `${10 + idx * 18}%` }}
            animate={{ y: [0, -30 - idx * 5, 0], opacity: [0.07, 0.12, 0.07], rotate: [0, idx % 2 === 0 ? 15 : -15, 0] }}
            transition={{ duration: 5 + idx * 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {note}
          </motion.div>
        ))}
      </div>

      <motion.div className="z-10 text-center w-full max-w-sm" variants={containerVariants}>
        {/* Logo */}
        <motion.div variants={itemVariants} className="mb-6">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-gold glow-gold mb-5"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Music className="w-10 h-10 text-amber-400" />
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            <span className="text-gradient-gold">신의 악단</span>
          </h1>
          <p className="text-amber-400/60 text-xs font-semibold tracking-[0.3em] uppercase">God's Orchestra</p>
        </motion.div>

        <motion.p variants={itemVariants} className="text-gray-400 text-sm leading-relaxed mb-6 px-2">
          양림동의 숨겨진 장소들을 찾아<br />하나님의 악보를 완성하세요
        </motion.p>

        {/* Game Rules */}
        <motion.div variants={itemVariants} className="mb-6">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl glass hover:bg-white/[0.04] transition-all"
          >
            <span className="text-sm font-semibold text-gray-300">게임 규칙 안내</span>
            {showRules ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
          </button>
          <AnimatePresence>
            {showRules && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-5 rounded-xl glass-gold text-left space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-amber-100 text-sm font-semibold mb-1">장소 찾기</p>
                      <p className="text-amber-200/60 text-xs leading-relaxed">팀에게 배정된 5개의 장소를 순서대로 찾아가세요. 각 장소에는 힌트가 제공됩니다.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-amber-100 text-sm font-semibold mb-1">제한 시간</p>
                      <p className="text-amber-200/60 text-xs leading-relaxed">30분 안에 최대한 많은 장소를 찾으면 됩니다. 지도와 힌트를 잘 활용하세요!</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-amber-100 text-sm font-semibold mb-1">팀 협동</p>
                      <p className="text-amber-200/60 text-xs leading-relaxed">팀원들과 함께 움직이세요. 장소에 도착하면 체크인 버튼으로 확인합니다.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Login Form */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium tracking-wide text-left">팀 번호</label>
            <input
              type="number"
              min="1"
              max="10"
              inputMode="numeric"
              value={teamInput}
              onChange={(e) => { setTeamInput(e.target.value); setError('') }}
              placeholder="팀 번호 입력 (1-10)"
              className="w-full px-4 py-3.5 rounded-xl glass text-white placeholder-gray-500 text-sm focus:border-amber-400/30 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium tracking-wide text-left">비밀번호</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="4자리 비밀번호"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl glass text-white placeholder-gray-500 text-sm focus:border-amber-400/30 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-all"
              />
            </div>
          </div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-400/15"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-300 text-xs font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.button
          variants={itemVariants}
          onClick={handleLogin}
          disabled={!teamInput || !passwordInput}
          className={`w-full mt-5 py-4 rounded-xl font-bold text-base transition-all duration-300 ${
            teamInput && passwordInput
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-900 glow-gold hover:shadow-amber-400/30 hover:shadow-xl cursor-pointer'
              : 'glass text-gray-600 cursor-not-allowed'
          }`}
          whileHover={teamInput && passwordInput ? { scale: 1.02 } : {}}
          whileTap={teamInput && passwordInput ? { scale: 0.98 } : {}}
        >
          {teamInput && passwordInput ? '입장하기' : '팀 번호와 비밀번호를 입력하세요'}
        </motion.button>

        <motion.p variants={itemVariants} className="mt-8 text-[11px] text-gray-600">
          광주 CCC · 양림동 미션
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
