import { useState } from 'react'
import { User } from '../api/auth'
import { createManagerUserApi, updateManagerUserApi, deleteManagerUserApi } from '../api/manager'

interface Props {
  users: User[]
  onUsersChange: () => void
}

export default function ManagerPanel({ users, onUsersChange }: Props) {
  const [newUsername, setNewUsername] = useState('')
  const [newFullname, setNewFullname] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('user')

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    await createManagerUserApi({ username: newUsername, password: newPassword, role: newRole, fullname: newFullname || undefined })
    setNewUsername('')
    setNewFullname('')
    setNewPassword('')
    onUsersChange()
  }

  const nextRole = (role: string) => role === 'user' ? 'manager' : 'user'

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Full Name" value={newFullname} onChange={(e) => setNewFullname(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer">
          <option value="user">User</option>
          <option value="manager">Manager</option>
        </select>
        <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">Add</button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Username</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Full Name</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Role</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-slate-900">{u.username}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{u.fullname || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-900">{u.role}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={async () => { await updateManagerUserApi(u.id, { role: nextRole(u.role) }); onUsersChange() }} className="mr-2 px-2 py-1 rounded text-xs text-sky-600 border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer">
                  Toggle Role
                </button>
                <button onClick={async () => { if (confirm('Delete user?')) { await deleteManagerUserApi(u.id); onUsersChange() } }} className="px-2 py-1 rounded text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
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
