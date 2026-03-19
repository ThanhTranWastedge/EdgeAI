import { useState } from 'react'
import { AxiosError } from 'axios'
import { changePasswordApi } from '../api/auth'

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
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Settings</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="current-pw" className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors" />
          </div>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors cursor-pointer">
            Update Password
          </button>
          {message && <div className="text-green-500 text-sm">{message}</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  )
}
