import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../domain/errors.ts'
import { useAuth } from '../session/index.ts'
import {
  AuthShell,
  BrandLabel,
  Button,
  Card,
  Heading,
  Stack,
  Text,
  TextField,
  TextLink,
} from '../ui/index.ts'

const MIN_PASSWORD = 8

export function InvitePage() {
  const { acceptInvite } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await acceptInvite(token, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'This invitation could not be accepted'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <Stack gap="sm">
        <BrandLabel>Feedback coder</BrandLabel>
        <Heading level={1}>Set your password</Heading>
        <Text tone="muted">
          You were invited to tag comments and export a spreadsheet. Choose a
          password to finish.
        </Text>
      </Stack>

      {!token ? (
        <Card>
          <Text tone="error">
            This invitation link is missing its token. Ask an admin to send a
            new one.
          </Text>
          <TextLink to="/login">Go to sign in</TextLink>
        </Card>
      ) : (
        <Card>
          <form onSubmit={(event) => void onSubmit(event)}>
            <Stack gap="md">
              {error ? <Text tone="error">{error}</Text> : null}
              <TextField
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <TextField
                label="Confirm password"
                type="password"
                name="confirm"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
              <Text tone="hint">At least {MIN_PASSWORD} characters.</Text>
              <Button type="submit" disabled={busy}>
                Accept invitation
              </Button>
            </Stack>
          </form>
        </Card>
      )}
    </AuthShell>
  )
}
