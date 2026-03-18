import client from './client'

export const changePasswordApi = (data: { current_password: string; new_password: string }) =>
  client.post('/auth/change-password', data)
