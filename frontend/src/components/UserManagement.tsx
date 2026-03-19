import { useEffect, useState } from 'react'
import { User } from '../api/auth'
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../api/admin'
import { useAuthStore } from '../store/authStore'
import UserTable from './UserTable'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const currentUserId = useAuthStore((s) => s.user?.id)

  const loadUsers = () => listUsersApi().then(({ data }) => setUsers(data))
  useEffect(() => { loadUsers() }, [])

  const roleCycle: Record<string, string> = { user: 'manager', manager: 'admin', admin: 'user' }

  return (
    <UserTable
      users={users}
      availableRoles={['user', 'manager', 'admin']}
      currentUserId={currentUserId}
      onCreateUser={async (data) => { await createUserApi(data); loadUsers() }}
      onToggleRole={async (id, role) => { await updateUserApi(id, { role: roleCycle[role] || 'user' }); loadUsers() }}
      onDeleteUser={async (id) => { await deleteUserApi(id); loadUsers() }}
    />
  )
}
