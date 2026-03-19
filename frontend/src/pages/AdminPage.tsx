import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import AdminPanel from '../components/AdminPanel'
import UserManagement from '../components/UserManagement'
import SectionCard from '../components/SectionCard'

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/chat')
  }, [user])

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Admin Panel</h2>
      <SectionCard title="Integrations">
        <AdminPanel />
      </SectionCard>
      <SectionCard title="Users">
        <UserManagement />
      </SectionCard>
    </div>
  )
}
