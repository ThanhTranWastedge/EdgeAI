import client from './client'
import { User } from './auth'

export interface UserAccess {
  id: string
  integration_id: string
  integration_name: string
}

export const listManagerUsersApi = () =>
  client.get<User[]>('/manager/users')

export const createManagerUserApi = (username: string, password: string, role: string) =>
  client.post<User>('/manager/users', { username, password, role })

export const updateManagerUserApi = (userId: string, data: { role?: string; password?: string }) =>
  client.put<User>(`/manager/users/${userId}`, data)

export const deleteManagerUserApi = (userId: string) =>
  client.delete(`/manager/users/${userId}`)

export const getUserAccessApi = (userId: string) =>
  client.get<UserAccess[]>(`/manager/users/${userId}/access`)

export const setUserAccessApi = (userId: string, integrationIds: string[]) =>
  client.put<UserAccess[]>(`/manager/users/${userId}/access`, { integration_ids: integrationIds })
