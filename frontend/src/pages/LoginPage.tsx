import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0d1117' }}>
      <form onSubmit={handleSubmit} style={{ background: '#161b22', padding: 32, borderRadius: 8, border: '1px solid #30363d', width: 360 }}>
        <h1 style={{ color: '#64ffda', marginBottom: 24, fontSize: 24 }}>EdgeAI</h1>
        {error && <div style={{ color: '#cf6679', marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 12, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 16, background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e0e0e0', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ width: '100%', padding: 10, background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          Sign In
        </button>
      </form>
    </div>
  )
}
