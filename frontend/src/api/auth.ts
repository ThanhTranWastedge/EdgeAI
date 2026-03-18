import client from './client'

export interface User {
  id: string
  username: string
  fullname: string | null
  role: string
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

export const changePasswordApi = (data: { current_password: string; new_password: string }) =>
  client.post('/auth/change-password', data)
