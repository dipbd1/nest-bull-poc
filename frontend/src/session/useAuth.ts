import { useContext } from 'react'
import { AuthContext } from './context.ts'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within SessionProvider')
  }
  return context
}
