import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './session/index.ts'
import { PageMessage } from './ui/index.ts'

export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return <PageMessage>Loading…</PageMessage>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/** Connections, People, and Audit. Reviewers are sent back to the batches. */
export function RequireAdmin() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()

  if (!ready) {
    return <PageMessage>Loading…</PageMessage>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}
