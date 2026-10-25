import type {
  AuditPage,
  AuthTokenResponse,
  InviteView,
  PersonView,
  UserRole,
} from '../domain/types.ts'
import { request } from './client.ts'

export function listPeople() {
  return request<PersonView[]>('/users')
}

export function listInvites() {
  return request<InviteView[]>('/users/invites')
}

export function sendInvite(email: string, role: UserRole) {
  return request<InviteView>('/users/invites', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

export function updatePerson(
  id: string,
  patch: { disabled?: boolean; role?: UserRole },
) {
  return request<PersonView>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function acceptInvite(token: string, password: string) {
  return request<AuthTokenResponse>('/users/invites/accept', {
    method: 'POST',
    anonymous: true,
    body: JSON.stringify({ token, password }),
  })
}

export function listAudit(params: { offset?: number; limit?: number } = {}) {
  const search = new URLSearchParams({
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 50),
  })
  return request<AuditPage>(`/audit?${search}`)
}
