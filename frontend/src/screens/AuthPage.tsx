import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { errorMessage } from '../domain/errors.ts'
import { useAuthConfig } from '../features/index.ts'
import { useAuth } from '../session/index.ts'
import {
  AnchorButton,
  AuthShell,
  BrandLabel,
  Button,
  Card,
  Heading,
  Stack,
  Text,
  TextField,
} from '../ui/index.ts'

type AuthMode = 'login' | 'register' | 'verify'

type LocationState = {
  from?: {
    pathname: string
  }
}

/** Codes the server puts in `/login?error=` after a company login attempt. */
const COMPANY_LOGIN_ERRORS: Record<string, string> = {
  oidc_not_invited:
    'That email has no account here. Ask an admin to invite you, then try again.',
  oidc_disabled: 'That account is disabled. Ask an admin.',
  oidc_unverified: 'Your company login has not verified that email address.',
  oidc_failed: 'Company login did not complete. Try again.',
}

export function AuthPage() {
  const { login, register, verify } = useAuth()
  const { emailVerificationRequired, publicRegistration, companyLogin, companyLoginUrl } =
    useAuthConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const loginErrorCode = searchParams.get('error')
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(
    loginErrorCode
      ? (COMPANY_LOGIN_ERRORS[loginErrorCode] ?? COMPANY_LOGIN_ERRORS.oidc_failed)
      : null,
  )
  const [busy, setBusy] = useState(false)

  function goTo(next: AuthMode) {
    setMode(next)
    setError(null)
    setPassword('')
    setCode('')
  }

  function continueToApp() {
    navigate(from, { replace: true })
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      continueToApp()
    } catch (err) {
      const message = errorMessage(err, 'Could not sign in')
      setError(message)
      if (emailVerificationRequired && message.toLowerCase().includes('not verified')) {
        setMode('verify')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await register(email, password)
      if (result.verificationRequired) {
        setEmail(result.email)
        setPassword('')
        setMode('verify')
        return
      }
      continueToApp()
    } catch (err) {
      setError(errorMessage(err, 'Could not create the account'))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verify(email, code.replace(/\s/g, ''))
      continueToApp()
    } catch (err) {
      setError(errorMessage(err, 'That code did not work'))
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create an account'
        : 'Check your email'

  return (
    <AuthShell>
      <Stack gap="sm">
        <BrandLabel>Feedback coder</BrandLabel>
        <Heading level={1}>{title}</Heading>
        <Text tone="muted">
          Tag a pile of comments, then export a spreadsheet.
        </Text>
      </Stack>

      {error ? <Text tone="error">{error}</Text> : null}

      {mode === 'login' ? (
        <Card>
          <form onSubmit={(event) => void onLogin(event)}>
            <Stack gap="md">
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button type="submit" disabled={busy}>
                Sign in
              </Button>
              {companyLogin ? (
                <AnchorButton variant="secondary" href={companyLoginUrl}>
                  Continue with company login
                </AnchorButton>
              ) : null}
              {publicRegistration ? (
                <Button variant="secondary" onClick={() => goTo('register')}>
                  Create an account
                </Button>
              ) : (
                <Text tone="hint">
                  Accounts are by invitation. Ask an admin to invite you.
                </Text>
              )}
              {emailVerificationRequired && publicRegistration ? (
                <Button variant="secondary" onClick={() => goTo('verify')}>
                  I already have a code
                </Button>
              ) : null}
            </Stack>
          </form>
        </Card>
      ) : null}

      {mode === 'register' && publicRegistration ? (
        <Card>
          <form onSubmit={(event) => void onRegister(event)}>
            <Stack gap="md">
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {emailVerificationRequired ? (
                <Text tone="hint">
                  We will email you a 6-digit code to confirm the address.
                </Text>
              ) : null}
              <Button type="submit" disabled={busy}>
                {emailVerificationRequired ? 'Send code' : 'Create account'}
              </Button>
              <Button variant="secondary" onClick={() => goTo('login')}>
                Back to sign in
              </Button>
            </Stack>
          </form>
        </Card>
      ) : null}

      {mode === 'verify' ? (
        <Card>
          <form onSubmit={(event) => void onVerify(event)}>
            <Stack gap="md">
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label="Verification code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
              <Text tone="hint">Enter the 6-digit code we emailed you.</Text>
              <Button type="submit" disabled={busy}>
                Verify and continue
              </Button>
              <Button variant="secondary" onClick={() => goTo('login')}>
                Back to sign in
              </Button>
            </Stack>
          </form>
        </Card>
      ) : null}
    </AuthShell>
  )
}
