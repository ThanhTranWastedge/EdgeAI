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
      <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Users</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <input placeholder="Full Name" value={newFullname} onChange={(e) => setNewFullname(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0' }}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
        </select>
        <button onClick={handleCreate} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Username</th>
            <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Full Name</th>
            <th style={{ textAlign: 'left', padding: 8, color: '#8b949e' }}>Role</th>
            <th style={{ textAlign: 'right', padding: 8, color: '#8b949e' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: 8 }}>{u.username}</td>
              <td style={{ padding: 8, color: '#8b949e' }}>{u.fullname || '—'}</td>
              <td style={{ padding: 8 }}>{u.role}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                <button onClick={async () => { await updateManagerUserApi(u.id, { role: nextRole(u.role) }); onUsersChange() }} style={{ marginRight: 8, padding: '4px 8px', background: '#21262d', border: '1px solid #30363d', borderRadius: 4, color: '#8b949e', cursor: 'pointer', fontSize: 11 }}>
                  Toggle Role
                </button>
                <button onClick={async () => { if (confirm('Delete user?')) { await deleteManagerUserApi(u.id); onUsersChange() } }} style={{ padding: '4px 8px', background: '#21262d', border: '1px solid #cf6679', borderRadius: 4, color: '#cf6679', cursor: 'pointer', fontSize: 11 }}>
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
