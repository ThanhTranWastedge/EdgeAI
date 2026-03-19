import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import AdminPanel from '../components/AdminPanel'
import UserManagement from '../components/UserManagement'

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/chat')
  }, [user])

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Admin Panel</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Integrations</h3>
        </div>
        <div className="p-6">
          <AdminPanel />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
        </div>
        <div className="p-6">
          <UserManagement />
        </div>
      </div>
    </div>
  )
}
