import type {
  AuthPublicConfig,
  AuthTokenResponse,
  AuthUser,
  ConsumerStatus,
  ConversationDetail,
  ConversationSummary,
  FreeModel,
  ProducerJob,
  ProducerPayload,
  QueueStatus,
  RegisterResponse,
} from './types.ts'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'accessToken'

type RequestOptions = RequestInit & {
  auth?: boolean
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join(', ')
    }
  }
  return fallback
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { auth = true, ...fetchInit } = init
  const headers = new Headers(fetchInit.headers)
  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = auth ? getAccessToken() : null
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...fetchInit, headers })
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAccessToken()
      onUnauthorized?.()
    }
    const text = await response.text()
    let message = text || response.statusText
    try {
      message = readErrorMessage(JSON.parse(text), message)
    } catch {
      // Keep the raw body when the server did not return JSON.
    }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}

export function getAuthConfig() {
  return request<AuthPublicConfig>('/auth/config', { auth: false })
}

export function register(email: string, password: string) {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  })
}

export function verifyRegistration(email: string, code: string) {
  return request<AuthTokenResponse>('/auth/register/verify', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, code }),
  })
}

export function login(email: string, password: string) {
  return request<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return request<AuthUser>('/auth/me')
}

export function getQueueStatus() {
  return request<QueueStatus>('/queue/status', { auth: false })
}

export function listJobs() {
  return request<ProducerJob[]>('/producer')
}

export function listFreeModels() {
  return request<FreeModel[]>('/producer/models')
}

export function createJob(payload: ProducerPayload) {
  return request<ProducerPayload>('/producer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateJob(id: string, payload: Partial<ProducerPayload>) {
  return request<ProducerJob>(`/producer/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteJob(id: string) {
  return request<ProducerJob>(`/producer/${id}`, { method: 'DELETE' })
}

export function deleteAllJobs() {
  return request<ProducerJob[]>('/producer', { method: 'DELETE' })
}

export function getConsumerStatus() {
  return request<ConsumerStatus>('/consumer')
}

export function setConsumerRunning(running: boolean) {
  return request<ConsumerStatus>('/consumer', {
    method: 'PATCH',
    body: JSON.stringify({ running }),
  })
}

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
