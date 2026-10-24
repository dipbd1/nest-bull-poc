import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { getQueueStatus } from './api.ts'
import { useAuth } from './auth.tsx'
import { QueueStatusBar } from './components/QueueStatusBar.tsx'
import type { LayoutContext, QueueStatus } from './types.ts'

const POLL_MS = 3000

export function App() {
  const { user, logout } = useAuth()
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getQueueStatus()
      setStatus(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue status')
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refreshStatus])

  return (
    <div className="shell">
      <header className="topbar">
        <p className="brand">Queue console</p>
        <div className="topbar-end">
          <nav>
            <NavLink to="/" end>
              Producer
            </NavLink>
            <NavLink to="/consumers">Consumers</NavLink>
          </nav>
          <span className="user-email">{user?.email}</span>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <QueueStatusBar status={status} error={error} />
      <main>
        <Outlet context={{ refreshStatus } satisfies LayoutContext} />
      </main>
    </div>
  )
}
