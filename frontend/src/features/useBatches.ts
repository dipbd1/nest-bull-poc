import { useCallback, useEffect, useState } from 'react'
import { listBatches } from '../api/index.ts'
import { anyBatchQueued } from '../domain/batches.ts'
import { errorMessage } from '../domain/errors.ts'
import type { BatchSummary } from '../domain/types.ts'

export const POLL_MS = 3000

/** Batch summaries. Polls only while some comment in some batch is queued. */
export function useBatches(pollMs = POLL_MS) {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setBatches(await listBatches())
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Could not load batches'))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void listBatches()
      .then((next) => {
        if (!cancelled) setBatches(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load batches'))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const polling = anyBatchQueued(batches)
  useEffect(() => {
    if (!polling) return
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [polling, pollMs, refresh])

  return { batches, loaded, error }
}
