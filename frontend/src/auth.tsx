import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import {
  clearAccessToken,
  getAccessToken,
  getMe,
  login as loginRequest,
  register as registerRequest,
  setAccessToken,
  setUnauthorizedHandler,
  verifyRegistration,
} from './api.ts'
import type { AuthUser } from './types.ts'

type AuthContextValue = {
  user: AuthUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<string>
  verify: (email: string, code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!getAccessToken()) {
        if (!cancelled) setReady(true)
        return
      }

      try {
        const profile = await getMe()
        if (!cancelled) setUser(profile)
      } catch {
        if (!cancelled) {
          clearAccessToken()
          setUser(null)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async login(email, password) {
        const { accessToken } = await loginRequest(email, password)
        setAccessToken(accessToken)
        setUser(await getMe())
      },
      async register(email, password) {
        const result = await registerRequest(email, password)
        return result.email
      },
      async verify(email, code) {
        const { accessToken } = await verifyRegistration(email, code)
        setAccessToken(accessToken)
        setUser(await getMe())
      },
      logout() {
        clearAccessToken()
        setUser(null)
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function LoadingShell() {
  return (
    <div className="shell">
      <p>Loading…</p>
    </div>
  )
}

export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return <LoadingShell />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()

  if (!ready) {
    return <LoadingShell />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}
