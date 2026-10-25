import type {
  ConversationDetail,
  ConversationSummary,
} from '../domain/types.ts'
import { request } from './client.ts'

export function listConversations() {
  return request<ConversationSummary[]>('/conversations')
}

export function getConversation(id: string) {
  return request<ConversationDetail>(`/conversations/${id}`)
}

export function sendConversationMessage(id: string, content: string) {
  return request<ConversationDetail>(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}
