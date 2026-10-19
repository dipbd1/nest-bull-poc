import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router'
import { getConsumerStatus, setConsumerRunning } from '../api.ts'
import type { LayoutContext } from '../types.ts'

export function ConsumersPage() {
  const { refreshStatus } = useOutletContext<LayoutContext>()
  const [running, setRunning] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getConsumerStatus()
      .then((status) => {
        if (!cancelled) setRunning(status.running)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load consumer status',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onToggle() {
    if (running === null) return
    setBusy(true)
    setError(null)
    try {
      const status = await setConsumerRunning(!running)
      setRunning(status.running)
      await refreshStatus()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update consumer',
      )
    } finally {
      setBusy(false)
    }
  }

  const label =
    running === null
      ? 'Checking worker…'
      : running
        ? 'Turn consumers off'
        : 'Turn consumers on'

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Consumers</h1>
          <p className="muted">
            Pause or resume the queue worker without restarting the API.
          </p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="card consumer-card">
        <p className="consumer-state">
          {running === null
            ? 'Worker status unknown'
            : running
              ? 'Worker is running'
              : 'Worker is paused'}
        </p>
        <button
          type="button"
          className={running ? 'danger' : undefined}
          onClick={() => void onToggle()}
          disabled={busy || running === null}
        >
          {label}
        </button>
      </div>
    </section>
  )
}
