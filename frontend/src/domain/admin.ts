import type {
  AuditEvent,
  ConnectionState,
  ConnectionView,
  PersonView,
  UserRole,
} from './types.ts'

export const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  not_configured: 'Not configured',
  check_failed: 'Check failed',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
}

/** `host: db.example.com` style lines from the non-secret details. */
export function connectionDetailLines(connection: ConnectionView): string[] {
  return Object.entries(connection.details)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
}

export function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function replaceConnection(
  connections: ConnectionView[],
  next: ConnectionView,
): ConnectionView[] {
  return connections.map((connection) =>
    connection.tool === next.tool ? next : connection,
  )
}

export function isDisabled(person: PersonView): boolean {
  return person.disabledAt !== null
}

/** `batch.export` becomes `Batch export`. */
export function auditActionLabel(action: string): string {
  return humanizeKey(action.replace(/\./g, ' '))
}

export function auditDetailLine(event: AuditEvent): string {
  const parts = Object.entries(event.metadata)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => {
      const shown = Array.isArray(value) ? value.join(', ') : String(value)
      return `${humanizeKey(key)}: ${shown}`
    })
  return parts.join(' · ')
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
