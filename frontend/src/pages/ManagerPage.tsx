import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { User } from '../api/auth'
import { listManagerUsersApi } from '../api/manager'
import Layout from '../components/Layout'
import ManagerPanel from '../components/ManagerPanel'
import UserAccessEditor from '../components/UserAccessEditor'

export default function ManagerPage() {
  const { user, checkAuth } = useAuthStore()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])

  const loadUsers = useCallback(() => {
    listManagerUsersApi().then(({ data }) => setUsers(data)).catch(() => {})
  }, [])

  useEffect(() => { checkAuth() }, [])

  useEffect(() => {
    if (user && user.role === 'user') navigate('/chat')
  }, [user])

  useEffect(() => { loadUsers() }, [loadUsers])

  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Manager Panel</h2>
        <div style={{ marginBottom: 32 }}>
          <ManagerPanel users={users} onUsersChange={loadUsers} />
        </div>
        <UserAccessEditor users={users} />
      </div>
    </Layout>
  )
}
