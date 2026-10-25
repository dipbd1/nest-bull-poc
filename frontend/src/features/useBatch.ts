import { useCallback, useEffect, useState } from 'react'
import {
  acceptSuggested,
  addComments as postComments,
  deleteBatch,
  deleteBatchItem,
  exportBatchCsv,
  getBatch,
  setFinalTag,
} from '../api/index.ts'
import { hasQueuedRows } from '../domain/batches.ts'
import { errorMessage } from '../domain/errors.ts'
import type { BatchDetail } from '../domain/types.ts'
import { downloadTextFile } from './downloadTextFile.ts'
import { POLL_MS } from './useBatches.ts'

/**
 * One batch with its rows and the actions on them. Polls only while some row
 * is queued, then stops. A refresh restores everything from the server.
 */
export function useBatch(batchId: string | undefined, pollMs = POLL_MS) {
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!batchId) return
    try {
      setBatch(await getBatch(batchId))
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Could not load this batch'))
    } finally {
      setLoaded(true)
    }
  }, [batchId])

  useEffect(() => {
    if (!batchId) return
    let cancelled = false
    void getBatch(batchId)
      .then((next) => {
        if (!cancelled) setBatch(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load this batch'))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [batchId])

  const polling = hasQueuedRows(batch)
  useEffect(() => {
    if (!polling) return
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [polling, pollMs, refresh])

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(errorMessage(err, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function retag(itemId: string, finalTag: string) {
    if (!batchId) return
    if (await run(() => setFinalTag(batchId, itemId, finalTag), 'Could not save the tag')) {
      await refresh()
    }
  }

  async function accept() {
    if (!batchId) return
    let updated = 0
    const ok = await run(async () => {
      updated = (await acceptSuggested(batchId)).updated
    }, 'Could not accept the suggestions')
    if (ok) {
      setNotice(
        updated === 1 ? 'Accepted 1 suggestion.' : `Accepted ${updated} suggestions.`,
      )
      await refresh()
    }
  }

  async function exportCsv() {
    if (!batchId) return
    await run(async () => {
      const file = await exportBatchCsv(batchId)
      downloadTextFile(file.filename, file.text, 'text/csv;charset=utf-8')
    }, 'Could not export the batch')
  }

  /** Resolves true when the batch is gone. */
  function remove() {
    if (!batchId) return Promise.resolve(false)
    return run(() => deleteBatch(batchId), 'Could not delete the batch')
  }

  /** Resolves true when the new comments are on the batch. */
  async function addComments(comments: string) {
    if (!batchId) return false
    const ok = await run(
      () => postComments(batchId, comments),
      'Could not add the comments',
    )
    if (ok) await refresh()
    return ok
  }

  async function removeItem(itemId: string) {
    if (!batchId) return
    if (await run(() => deleteBatchItem(batchId, itemId), 'Could not delete the comment')) {
      await refresh()
    }
  }

  return {
    batch,
    loaded,
    error,
    notice,
    busy,
    polling,
    retag,
    accept,
    exportCsv,
    remove,
    addComments,
    removeItem,
  }
}
