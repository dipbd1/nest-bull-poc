import { createContext } from 'react'
import type { AuthUser } from '../domain/types.ts'

export type AuthContextValue = {
  user: AuthUser | null
  ready: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
  ) => Promise<{ email: string; verificationRequired: boolean }>
  verify: (email: string, code: string) => Promise<void>
  acceptInvite: (token: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
