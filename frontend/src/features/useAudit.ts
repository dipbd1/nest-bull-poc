import { useCallback, useEffect, useState } from 'react'
import { listAudit } from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'
import type { AuditEvent } from '../domain/types.ts'

const PAGE_SIZE = 50

/** Newest first. `loadMore` appends the next page. */
export function useAudit(pageSize = PAGE_SIZE) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(
    async (offset: number) => {
      try {
        const page = await listAudit({ offset, limit: pageSize })
        setEvents((current) =>
          offset === 0 ? page.items : [...current, ...page.items],
        )
        setTotal(page.total)
        setError(null)
      } catch (err) {
        setError(errorMessage(err, 'Could not load the audit log'))
      } finally {
        setLoaded(true)
        setLoadingMore(false)
      }
    },
    [pageSize],
  )

  useEffect(() => {
    let cancelled = false
    void listAudit({ offset: 0, limit: pageSize })
      .then((page) => {
        if (cancelled) return
        setEvents(page.items)
        setTotal(page.total)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load the audit log'))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [pageSize])

  async function loadMore() {
    setLoadingMore(true)
    await loadPage(events.length)
  }

  return {
    events,
    total,
    loaded,
    loadingMore,
    error,
    hasMore: events.length < total,
    loadMore,
  }
}
