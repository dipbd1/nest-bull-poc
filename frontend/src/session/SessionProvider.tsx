import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  acceptInvite as acceptInviteRequest,
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  setUnauthorizedHandler,
  verifyRegistration,
} from '../api/index.ts'
import type { AuthUser } from '../domain/types.ts'
import { AuthContext, type AuthContextValue } from './context.ts'

/** Older builds kept the bearer token here. Drop it; the cookie is the session. */
const LEGACY_TOKEN_KEY = 'accessToken'

export function SessionProvider({ children }: { children: ReactNode }) {
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
    localStorage.removeItem(LEGACY_TOKEN_KEY)

    async function boot() {
      try {
        // The httpOnly cookie is invisible to the page, so ask the server.
        const profile = await getMe()
        if (!cancelled) setUser(profile)
      } catch {
        if (!cancelled) setUser(null)
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
      isAdmin: user?.role === 'admin',
      async login(email, password) {
        await loginRequest(email, password)
        setUser(await getMe())
      },
      async register(email, password) {
        const result = await registerRequest(email, password)
        if (!result.verificationRequired) {
          setUser(await getMe())
        }
        return {
          email: result.email,
          verificationRequired: result.verificationRequired,
        }
      },
      async verify(email, code) {
        await verifyRegistration(email, code)
        setUser(await getMe())
      },
      async acceptInvite(token, password) {
        await acceptInviteRequest(token, password)
        setUser(await getMe())
      },
      async logout() {
        try {
          await logoutRequest()
        } finally {
          setUser(null)
        }
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
