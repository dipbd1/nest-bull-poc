import { useEffect, useState } from 'react'
import { listBatchModels } from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'
import type { BatchModels } from '../domain/types.ts'

/** Free OpenRouter models a reviewer can code a batch with. */
export function useBatchModels() {
  const [data, setData] = useState<BatchModels | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listBatchModels()
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load models'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    models: data?.models ?? [],
    defaultModel: data?.defaultModel ?? '',
    ready: data?.ready ?? false,
    loaded: data !== null || error !== null,
    error,
  }
}
