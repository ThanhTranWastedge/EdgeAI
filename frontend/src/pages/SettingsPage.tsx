import { useState } from 'react'
import Layout from '../components/Layout'
import { changePasswordApi } from '../api/settings'

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setMessage('')
    setError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    try {
      await changePasswordApi({ current_password: currentPassword, new_password: newPassword })
      setMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password')
    }
  }

  const inputStyle = { padding: 8, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e0e0e0', width: '100%' }

  return (
    <Layout>
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <h2 style={{ color: '#64ffda', marginBottom: 24 }}>Settings</h2>
        <div style={{ maxWidth: 400 }}>
          <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Change Password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
            <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#64ffda', color: '#0d1117', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Update Password</button>
          </div>
          {message && <div style={{ marginTop: 12, color: '#64ffda', fontSize: 13 }}>{message}</div>}
          {error && <div style={{ marginTop: 12, color: '#cf6679', fontSize: 13 }}>{error}</div>}
        </div>
      </div>
    </Layout>
  )
}
