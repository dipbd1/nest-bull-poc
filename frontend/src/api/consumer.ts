import type { ConsumerStatus } from '../domain/types.ts'
import { request } from './client.ts'

export function getConsumerStatus() {
  return request<ConsumerStatus>('/consumer')
}

export function setConsumerRunning(running: boolean) {
  return request<ConsumerStatus>('/consumer', {
    method: 'PATCH',
    body: JSON.stringify({ running }),
  })
}
