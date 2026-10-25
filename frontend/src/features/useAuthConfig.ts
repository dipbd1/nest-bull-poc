import { useEffect, useState } from 'react'
import { companyLoginUrl, getAuthConfig } from '../api/index.ts'
import type { AuthPublicConfig } from '../domain/types.ts'

/**
 * Defaults to the safe side until the server answers: verification required,
 * no public sign-up.
 */
const DEFAULT_CONFIG: AuthPublicConfig = {
  emailVerificationRequired: true,
  publicRegistration: false,
  companyLogin: false,
}

export function useAuthConfig() {
  const [config, setConfig] = useState<AuthPublicConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let cancelled = false
    void getAuthConfig()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_CONFIG)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...config, companyLoginUrl: companyLoginUrl() }
}
