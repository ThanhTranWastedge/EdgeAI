import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { btnPrimaryCls } from '../styles'

const glassInputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30'

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
      <form onSubmit={handleSubmit} className="relative bg-white/20 backdrop-blur-md rounded-xl shadow-lg p-8 w-[400px] border border-white/30">
        <h1 className="text-2xl font-bold text-white mb-6">EdgeAI</h1>
        {error && <div className="text-red-300 text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-white mb-1">Username</label>
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
            <label htmlFor="password" className="block text-sm font-medium text-white mb-1">Password</label>
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
            className={`w-full ${btnPrimaryCls} focus:outline-none focus:ring-2 focus:ring-sky-500/20`}
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  )
}
