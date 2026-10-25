import { useState, type FormEvent } from 'react'
import { ROLE_LABEL, formatDate, isDisabled } from '../domain/admin.ts'
import { USER_ROLES, type UserRole } from '../domain/types.ts'
import { usePeople } from '../features/index.ts'
import { useAuth } from '../session/index.ts'
import {
  Badge,
  Button,
  Card,
  Heading,
  RowList,
  RowListItem,
  Select,
  Stack,
  Text,
  TextField,
} from '../ui/index.ts'
import styles from './PeoplePage.module.css'

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
}))

export function PeoplePage() {
  const { user } = useAuth()
  const people = usePeople()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('reviewer')

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await people.invite(email, role)) setEmail('')
  }

  return (
    <Stack>
      <Stack gap="xs">
        <Heading level={1}>People</Heading>
        <Text tone="muted">
          Invite a reviewer by email. Disable someone to end their access.
        </Text>
      </Stack>

      <Card>
        <Heading>Invite someone</Heading>
        <form onSubmit={(event) => void onInvite(event)}>
          <div className={styles.form}>
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Select
              label="Role"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(event) => setRole(event.target.value as UserRole)}
            />
            <Button type="submit" disabled={people.busy || !email.trim()}>
              Send invite
            </Button>
          </div>
        </form>
        {people.error ? <Text tone="error">{people.error}</Text> : null}
        {people.notice ? <Text tone="hint">{people.notice}</Text> : null}
      </Card>

      <Card>
        <Heading>Everyone</Heading>
        {!people.loaded ? <Text tone="muted">Loading people…</Text> : null}
        <RowList>
          {people.people.map((person) => {
            const disabled = isDisabled(person)
            const isSelf = person.id === user?.id
            return (
              <RowListItem key={person.id}>
                <div className={styles.person}>
                  <Stack gap="xs">
                    <Stack direction="row" gap="sm" align="center" wrap>
                      <span className={styles.email}>{person.email}</span>
                      <Badge tone={person.role === 'admin' ? 'accent' : 'neutral'}>
                        {ROLE_LABEL[person.role]}
                      </Badge>
                      {disabled ? <Badge tone="danger">Disabled</Badge> : null}
                    </Stack>
                    <Text tone="hint">Joined {formatDate(person.createdAt)}</Text>
                  </Stack>
                  {isSelf ? (
                    <Text tone="hint">You</Text>
                  ) : (
                    <Button
                      variant={disabled ? 'secondary' : 'danger'}
                      disabled={people.busy}
                      onClick={() => void people.setDisabled(person.id, !disabled)}
                    >
                      {disabled ? 'Enable' : 'Disable'}
                    </Button>
                  )}
                </div>
              </RowListItem>
            )
          })}
        </RowList>
      </Card>

      {people.invites.length > 0 ? (
        <Card>
          <Heading>Waiting to accept</Heading>
          <RowList>
            {people.invites.map((invite) => (
              <RowListItem key={invite.id}>
                <Stack direction="row" gap="sm" align="center" wrap>
                  <span className={styles.email}>{invite.email}</span>
                  <Badge>{ROLE_LABEL[invite.role]}</Badge>
                  <Text tone="hint" as="span">
                    Expires {formatDate(invite.expiresAt)}
                  </Text>
                </Stack>
              </RowListItem>
            ))}
          </RowList>
        </Card>
      ) : null}
    </Stack>
  )
}
