import client from './client'
import { User } from './auth'

export const listUsersApi = (page = 1, pageSize = 50) =>
  client.get<User[]>('/admin/users', { params: { page, page_size: pageSize } })

export const createUserApi = (username: string, password: string, role: string) =>
  client.post<User>('/admin/users', { username, password, role })

export const updateUserApi = (userId: string, data: { role?: string; password?: string }) =>
  client.put<User>(`/admin/users/${userId}`, data)

export const deleteUserApi = (userId: string) =>
  client.delete(`/admin/users/${userId}`)
