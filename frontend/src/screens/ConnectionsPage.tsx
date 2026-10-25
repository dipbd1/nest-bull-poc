import { useState, type FormEvent } from 'react'
import {
  CONNECTION_STATE_LABEL,
  connectionDetailLines,
  formatDateTime,
} from '../domain/admin.ts'
import type { ConnectionState, ConnectionView } from '../domain/types.ts'
import { useConnections, useSettings } from '../features/index.ts'
import {
  Badge,
  Button,
  Card,
  Heading,
  RowList,
  RowListItem,
  Stack,
  Text,
  TextField,
  type BadgeTone,
} from '../ui/index.ts'
import styles from './ConnectionsPage.module.css'

const STATE_TONE: Record<ConnectionState, BadgeTone> = {
  connected: 'success',
  not_configured: 'neutral',
  check_failed: 'danger',
}

function ConnectionRow({
  connection,
  testing,
  onTest,
}: {
  connection: ConnectionView
  testing: boolean
  onTest: () => void
}) {
  const lines = connectionDetailLines(connection)

  return (
    <div className={styles.row}>
      <Stack gap="xs">
        <Stack direction="row" gap="sm" align="center" wrap>
          <Text tone="strong" as="span">
            {connection.label}
          </Text>
          <Badge tone={STATE_TONE[connection.state]}>
            {CONNECTION_STATE_LABEL[connection.state]}
          </Badge>
        </Stack>
        {connection.message ? (
          <Text tone={connection.state === 'check_failed' ? 'error' : 'muted'}>
            {connection.message}
          </Text>
        ) : null}
        {lines.length > 0 ? (
          <ul className={styles.details}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {connection.checkedAt ? (
          <Text tone="hint">Checked {formatDateTime(connection.checkedAt)}</Text>
        ) : null}
      </Stack>
      <Button variant="secondary" disabled={testing} onClick={onTest}>
        {testing ? 'Testing…' : 'Test'}
      </Button>
    </div>
  )
}

function SettingsCard() {
  const { settings, error, saving, save } = useSettings()
  const [retention, setRetention] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!settings) {
    return (
      <Card>
        <Heading>Keep period</Heading>
        {error ? <Text tone="error">{error}</Text> : <Text tone="muted">Loading…</Text>}
      </Card>
    )
  }

  const shownRetention =
    retention ?? (settings.retentionDays === null ? '' : String(settings.retentionDays))

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const days = shownRetention.trim()
    const ok = await save({
      retentionDays: days === '' ? null : Number(days),
    })
    if (ok) setRetention(null)
    setSaved(ok)
  }

  return (
    <Card>
      <Heading>Keep period</Heading>
      <form onSubmit={(event) => void onSubmit(event)}>
        <Stack gap="md">
          <Text tone="hint">
            Reviewers choose a free OpenRouter model when they create a batch.
          </Text>
          <TextField
            label="Keep batches for (days)"
            className={styles.retention}
            type="number"
            min={1}
            max={3650}
            inputMode="numeric"
            placeholder="Keep until deleted"
            value={shownRetention}
            onChange={(event) => {
              setRetention(event.target.value)
              setSaved(false)
            }}
          />
          {error ? <Text tone="error">{error}</Text> : null}
          {saved ? <Text tone="hint">Saved.</Text> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </form>
    </Card>
  )
}

export function ConnectionsPage() {
  const { connections, loaded, error, testing, test } = useConnections()

  return (
    <Stack>
      <Stack gap="xs">
        <Heading level={1}>Connections</Heading>
        <Text tone="muted">
          The tools this installation talks to. Keys and passwords stay in the
          server environment and are never shown here.
        </Text>
      </Stack>

      {error ? <Text tone="error">{error}</Text> : null}
      {!loaded ? <Text tone="muted">Checking connections…</Text> : null}

      {connections.length > 0 ? (
        <Card>
          <RowList>
            {connections.map((connection) => (
              <RowListItem key={connection.tool}>
                <ConnectionRow
                  connection={connection}
                  testing={testing === connection.tool}
                  onTest={() => void test(connection.tool)}
                />
              </RowListItem>
            ))}
          </RowList>
        </Card>
      ) : null}

      <SettingsCard />
    </Stack>
  )
}
