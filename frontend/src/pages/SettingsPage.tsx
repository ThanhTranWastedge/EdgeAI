import { useState } from 'react'
import { AxiosError } from 'axios'
import { changePasswordApi } from '../api/auth'
import SectionCard from '../components/SectionCard'
import { inputCls, btnPrimaryCls } from '../styles'

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
    } catch (err) {
      const detail = err instanceof AxiosError ? err.response?.data?.detail : undefined
      setError(detail || 'Failed to change password')
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-lg font-semibold text-amcs-black mb-6">Settings</h2>
      <SectionCard title="Change Password">
        <div className="space-y-4">
          <div>
            <label htmlFor="current-pw" className="block text-sm font-medium text-amcs-grey-600 mb-1">Current Password</label>
            <input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={`w-full ${inputCls}`} />
          </div>
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-amcs-grey-600 mb-1">New Password</label>
            <input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`w-full ${inputCls}`} />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-amcs-grey-600 mb-1">Confirm New Password</label>
            <input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full ${inputCls}`} />
          </div>
          <button onClick={handleSubmit} className={btnPrimaryCls}>
            Update Password
          </button>
          {message && <div className="text-amcs-positive text-sm">{message}</div>}
          {error && <div className="text-amcs-negative text-sm">{error}</div>}
        </div>
      </SectionCard>
    </div>
  )
}
