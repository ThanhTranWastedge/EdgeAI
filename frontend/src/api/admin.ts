import client from './client'
import { User } from './auth'
import { Integration } from './integrations'

export const listUsersApi = (page = 1, pageSize = 50) =>
  client.get<User[]>('/admin/users', { params: { page, page_size: pageSize } })

export const createUserApi = (username: string, password: string, role: string) =>
  client.post<User>('/admin/users', { username, password, role })

export const updateUserApi = (userId: string, data: { role?: string; password?: string }) =>
  client.put<User>(`/admin/users/${userId}`, data)

export const deleteUserApi = (userId: string) =>
  client.delete(`/admin/users/${userId}`)

export const createIntegrationApi = (data: { name: string; provider_type: string; provider_config: Record<string, unknown>; description?: string; icon?: string }) =>
  client.post<Integration>('/integrations', data)

export const updateIntegrationApi = (id: string, data: Record<string, unknown>) =>
  client.put<Integration>(`/integrations/${id}`, data)

export const deleteIntegrationApi = (id: string) =>
  client.delete(`/integrations/${id}`)
