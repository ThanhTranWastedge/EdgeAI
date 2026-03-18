import client from './client'

export interface Integration {
  id: string
  name: string
  provider_type: string
  description: string | null
  icon: string | null
}

export const listIntegrationsApi = () =>
  client.get<Integration[]>('/integrations')

export const createIntegrationApi = (data: { name: string; provider_type: string; provider_config: Record<string, unknown>; description?: string; icon?: string }) =>
  client.post<Integration>('/integrations', data)

export const updateIntegrationApi = (id: string, data: Record<string, unknown>) =>
  client.put<Integration>(`/integrations/${id}`, data)

export const deleteIntegrationApi = (id: string) =>
  client.delete(`/integrations/${id}`)
