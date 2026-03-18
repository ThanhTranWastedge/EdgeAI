import client from './client'
import { PinItem } from '../store/pinStore'

export const listPinsApi = (page = 1, pageSize = 50) =>
  client.get<PinItem[]>('/pins', { params: { page, page_size: pageSize } })

export const createPinApi = (messageId: string, label: string) =>
  client.post('/pins', { message_id: messageId, label })

export const updatePinApi = (pinId: string, label: string) =>
  client.put(`/pins/${pinId}`, { label })

export const deletePinApi = (pinId: string) =>
  client.delete(`/pins/${pinId}`)
