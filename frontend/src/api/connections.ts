import type {
  ConnectionTool,
  ConnectionView,
  SettingsUpdate,
  SettingsView,
} from '../domain/types.ts'
import { request } from './client.ts'

export function listConnections() {
  return request<ConnectionView[]>('/connections')
}

export function testConnection(tool: ConnectionTool) {
  return request<ConnectionView>(`/connections/${tool}/test`, {
    method: 'POST',
  })
}

export function getSettings() {
  return request<SettingsView>('/settings')
}

export function updateSettings(patch: SettingsUpdate) {
  return request<SettingsView>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
