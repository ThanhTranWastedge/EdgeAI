import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { User } from '../api/auth'
import { listManagerUsersApi } from '../api/manager'
import ManagerPanel from '../components/ManagerPanel'
import UserAccessEditor from '../components/UserAccessEditor'

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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
        </div>
        <div className="p-6">
          <ManagerPanel users={users} onUsersChange={loadUsers} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Integration Access</h3>
        </div>
        <div className="p-6">
          <UserAccessEditor users={users} />
        </div>
      </div>
    </div>
  )
}
