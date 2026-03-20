import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const glassInputCls = 'w-full px-3 py-2.5 rounded-[10px] text-sm bg-white/10 border border-white/20 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-we-accent/40'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleVideoEnd = useCallback(() => {
    timerRef.current = setTimeout(() => {
      videoRef.current?.play()
    }, 10000)
  }, [])

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/chat')
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-end pr-[10%] overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="absolute inset-0 w-full h-full object-cover"
        src="https://www.amcsgroup.com/static/assets/video/Amcs_Hero_Animation.mp4"
      />
      <div className="absolute inset-0 bg-black/40" />
      <form onSubmit={handleSubmit} className="relative bg-white/12 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-8 w-[400px] border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-we-accent rounded-lg flex items-center justify-center font-extrabold text-sm text-white">E</div>
            <span className="text-[22px] font-bold text-white">EdgeAI</span>
          </div>
          <div className="text-[11px] text-white/50 mt-1 tracking-[0.5px]">Enterprise</div>
        </div>
        {error && <div className="text-amcs-negative/70 text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-1">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className={glassInputCls}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={glassInputCls}
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-we-accent text-white font-bold text-sm shadow-[0_4px_12px_rgba(79,175,48,0.3)] hover:brightness-110 transition cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  )
}
