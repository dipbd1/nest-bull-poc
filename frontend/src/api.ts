import type {
  ConsumerStatus,
  ProducerJob,
  ProducerPayload,
  QueueStatus,
} from './types.ts'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(response.status, text || response.statusText)
  }

  return response.json() as Promise<T>
}

export function getQueueStatus() {
  return request<QueueStatus>('/queue/status')
}

export function listJobs() {
  return request<ProducerJob[]>('/producer')
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
