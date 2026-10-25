import { filenameFromDisposition } from '../domain/batches.ts'
import type {
  BatchDetail,
  BatchItem,
  BatchModels,
  BatchSummary,
  CsvDownload,
  NewBatchInput,
} from '../domain/types.ts'
import { request, requestText } from './client.ts'

export function listBatches() {
  return request<BatchSummary[]>('/batches')
}

export function listBatchModels() {
  return request<BatchModels>('/batches/models')
}

export function getBatch(id: string) {
  return request<BatchDetail>(`/batches/${id}`)
}

export function addComments(batchId: string, comments: string) {
  return request<BatchDetail>(`/batches/${batchId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export function createBatch(input: NewBatchInput) {
  return request<BatchDetail>('/batches', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function setFinalTag(batchId: string, itemId: string, finalTag: string) {
  return request<BatchItem>(`/batches/${batchId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ finalTag }),
  })
}

export function acceptSuggested(batchId: string) {
  return request<{ updated: number }>(`/batches/${batchId}/accept-suggested`, {
    method: 'POST',
  })
}

export async function exportBatchCsv(batchId: string): Promise<CsvDownload> {
  const { text, contentDisposition } = await requestText(
    `/batches/${batchId}/export`,
  )
  return {
    text,
    filename: filenameFromDisposition(contentDisposition, 'feedback.csv'),
  }
}

export function deleteBatch(batchId: string) {
  return request<void>(`/batches/${batchId}`, { method: 'DELETE' })
}

export function deleteBatchItem(batchId: string, itemId: string) {
  return request<void>(`/batches/${batchId}/items/${itemId}`, {
    method: 'DELETE',
  })
}
