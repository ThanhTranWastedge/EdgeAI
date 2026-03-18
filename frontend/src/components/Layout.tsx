import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117', color: '#e0e0e0' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span style={{ fontSize: 18, fontWeight: 'bold', color: '#64ffda', cursor: 'pointer' }} onClick={() => navigate('/chat')}>EdgeAI</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#8b949e', fontSize: 12 }}>{user?.username}</span>
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <button onClick={() => navigate('/manager')} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Manager</button>
          )}
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Admin</button>
          )}
          <button onClick={logout} style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>Logout</button>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
