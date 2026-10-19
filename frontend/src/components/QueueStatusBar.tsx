import type { QueueStatus } from '../types.ts'

const COUNTS = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const

type QueueStatusBarProps = {
  status: QueueStatus | null
  error: string | null
}

export function QueueStatusBar({ status, error }: QueueStatusBarProps) {
  if (error && !status) {
    return (
      <section className="status-bar" aria-live="polite">
        <p className="error">{error}</p>
      </section>
    )
  }

  if (!status) {
    return (
      <section className="status-bar" aria-live="polite">
        <p>Loading queue status…</p>
      </section>
    )
  }

  return (
    <section className="status-bar" aria-live="polite">
      <p className="status-name">
        Queue <strong>{status.name}</strong>
        <span className="muted"> · {status.total} total</span>
      </p>
      <ul className="counts">
        {COUNTS.map((key) => (
          <li key={key}>
            <span className="count-label">{key}</span>
            <span className="count-value">{status[key]}</span>
          </li>
        ))}
      </ul>
      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}
