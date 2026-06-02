import client from './client'

export interface User {
  id: string
  username: string
  fullname: string | null
  role: string
  default_integration_id: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export const loginApi = (username: string, password: string) =>
  client.post<LoginResponse>('/auth/login', { username, password })

export const getMeApi = () =>
  client.get<User>('/auth/me')

export const updateDefaultIntegrationApi = (integrationId: string | null) =>
  client.put<User>('/auth/default-integration', { integration_id: integrationId })

export const changePasswordApi = (data: { current_password: string; new_password: string }) =>
  client.post('/auth/change-password', data)
