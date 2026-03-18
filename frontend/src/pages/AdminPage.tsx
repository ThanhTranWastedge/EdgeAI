import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import AdminPanel from '../components/AdminPanel'
import UserManagement from '../components/UserManagement'

export default function AdminPage() {
  const { user, checkAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/chat')
  }, [user])

  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Admin Panel</h2>
        <div style={{ marginBottom: 32 }}>
          <AdminPanel />
        </div>
        <UserManagement />
      </div>
    </Layout>
  )
}
