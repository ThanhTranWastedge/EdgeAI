import { useState } from 'react'
import { User } from '../api/auth'
import { inputCls, selectCls, btnPrimaryCls, btnSecondaryCls, btnDangerCls, thCls } from '../styles'

interface Props {
  users: User[]
  availableRoles: string[]
  currentUserId: string | undefined
  onCreateUser: (data: { username: string; password: string; role: string; fullname?: string }) => Promise<void>
  onToggleRole: (userId: string, currentRole: string) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
}

export default function UserTable({ users, availableRoles, currentUserId, onCreateUser, onToggleRole, onDeleteUser }: Props) {
  const [newUsername, setNewUsername] = useState('')
  const [newFullname, setNewFullname] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState(availableRoles[0])

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    await onCreateUser({ username: newUsername, password: newPassword, role: newRole, fullname: newFullname || undefined })
    setNewUsername('')
    setNewFullname('')
    setNewPassword('')
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inputCls} />
        <input placeholder="Full Name" value={newFullname} onChange={(e) => setNewFullname(e.target.value)} className={inputCls} />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={selectCls}>
          {availableRoles.map((role) => (
            <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
          ))}
        </select>
        <button onClick={handleCreate} className={btnPrimaryCls}>Add</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-amcs-grey-100">
            <th className={thCls}>Username</th>
            <th className={thCls}>Full Name</th>
            <th className={thCls}>Role</th>
            <th className={`text-right ${thCls}`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amcs-grey-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-amcs-black">{u.username}</td>
              <td className="px-4 py-3 text-sm text-amcs-grey-400">{u.fullname || '—'}</td>
              <td className="px-4 py-3 text-sm text-amcs-black">{u.role}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onToggleRole(u.id, u.role)} className={btnSecondaryCls}>
                  Toggle Role
                </button>
                <button
                  disabled={u.id === currentUserId}
                  title={u.id === currentUserId ? 'You cannot delete your own account' : undefined}
                  onClick={u.id === currentUserId ? undefined : async () => { if (confirm('Delete user?')) await onDeleteUser(u.id) }}
                  className={`${btnDangerCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
