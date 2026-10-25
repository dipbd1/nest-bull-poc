import {
  auditActionLabel,
  auditDetailLine,
  formatDateTime,
} from '../domain/admin.ts'
import { useAudit } from '../features/index.ts'
import {
  Button,
  Card,
  Heading,
  RowList,
  RowListItem,
  Stack,
  Text,
} from '../ui/index.ts'
import styles from './AuditPage.module.css'

export function AuditPage() {
  const audit = useAudit()

  return (
    <Stack>
      <Stack gap="xs">
        <Heading level={1}>Audit</Heading>
        <Text tone="muted">
          Who did what, newest first. Events cannot be edited or deleted here.
        </Text>
      </Stack>

      {audit.error ? <Text tone="error">{audit.error}</Text> : null}
      {!audit.loaded ? <Text tone="muted">Loading events…</Text> : null}
      {audit.loaded && audit.events.length === 0 && !audit.error ? (
        <Text tone="muted">No events yet.</Text>
      ) : null}

      {audit.events.length > 0 ? (
        <Card>
          <RowList>
            {audit.events.map((event) => {
              const detail = auditDetailLine(event)
              return (
                <RowListItem key={event.id}>
                  <div className={styles.event}>
                    <Text tone="strong">{auditActionLabel(event.action)}</Text>
                    <Text tone="hint">
                      {event.actorEmail ?? 'System'} ·{' '}
                      {formatDateTime(event.createdAt)}
                    </Text>
                    {detail ? <span className={styles.detail}>{detail}</span> : null}
                  </div>
                </RowListItem>
              )
            })}
          </RowList>
          {audit.hasMore ? (
            <Button
              variant="secondary"
              disabled={audit.loadingMore}
              onClick={() => void audit.loadMore()}
            >
              {audit.loadingMore ? 'Loading…' : 'Show older events'}
            </Button>
          ) : null}
        </Card>
      ) : null}
    </Stack>
  )
}
