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
