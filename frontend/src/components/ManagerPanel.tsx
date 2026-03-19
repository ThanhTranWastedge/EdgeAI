import { User } from '../api/auth'
import { createManagerUserApi, updateManagerUserApi, deleteManagerUserApi } from '../api/manager'
import UserTable from './UserTable'

interface Props {
  users: User[]
  onUsersChange: () => void
}

export default function ManagerPanel({ users, onUsersChange }: Props) {
  const nextRole = (role: string) => role === 'user' ? 'manager' : 'user'

  return (
    <UserTable
      users={users}
      availableRoles={['user', 'manager']}
      onCreateUser={async (data) => { await createManagerUserApi(data); onUsersChange() }}
      onToggleRole={async (id, role) => { await updateManagerUserApi(id, { role: nextRole(role) }); onUsersChange() }}
      onDeleteUser={async (id) => { await deleteManagerUserApi(id); onUsersChange() }}
    />
  )
}
