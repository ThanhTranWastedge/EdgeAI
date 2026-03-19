import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { User } from '../api/auth'
import { listManagerUsersApi } from '../api/manager'
import ManagerPanel from '../components/ManagerPanel'
import UserAccessEditor from '../components/UserAccessEditor'
import SectionCard from '../components/SectionCard'

export default function ManagerPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])

  const loadUsers = useCallback(() => {
    listManagerUsersApi().then(({ data }) => setUsers(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (user && user.role === 'user') navigate('/chat')
  }, [user])

  useEffect(() => { loadUsers() }, [loadUsers])

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Manager Panel</h2>
      <SectionCard title="Users">
        <ManagerPanel users={users} onUsersChange={loadUsers} />
      </SectionCard>
      <SectionCard title="Integration Access">
        <UserAccessEditor users={users} />
      </SectionCard>
    </div>
  )
}
