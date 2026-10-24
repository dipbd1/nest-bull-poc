import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { getAuthConfig } from '../api.ts'
import { useAuth } from '../auth.tsx'

type AuthMode = 'login' | 'register' | 'verify'

type LocationState = {
  from?: {
    pathname: string
  }
}

export function AuthPage() {
  const { login, register, verify } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [emailVerificationRequired, setEmailVerificationRequired] =
    useState(true)

  useEffect(() => {
    let cancelled = false
    void getAuthConfig()
      .then((config) => {
        if (!cancelled) {
          setEmailVerificationRequired(config.emailVerificationRequired)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmailVerificationRequired(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function goTo(next: AuthMode) {
    setMode(next)
    setError(null)
    setPassword('')
    setCode('')
  }

  async function continueToApp() {
    navigate(from, { replace: true })
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      await continueToApp()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
      if (message.toLowerCase().includes('not verified')) {
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
      await continueToApp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register')
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
      await continueToApp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <header>
        <p className="brand">Queue console</p>
        <h1>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Register' : 'Verify email'}</h1>
        <p className="muted">
          Producer and consumer actions require an account.
          {emailVerificationRequired
            ? ' Registration codes land in Mailpit.'
            : null}
        </p>
      </header>

      {mode !== 'verify' ? (
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? undefined : 'secondary'}
            onClick={() => goTo('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? undefined : 'secondary'}
            onClick={() => goTo('register')}
          >
            Register
          </button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {mode === 'login' ? (
        <form className="card form" onSubmit={(event) => void onLogin(event)}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Sign in
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => goTo('verify')}
          >
            I already have a code
          </button>
        </form>
      ) : null}

      {mode === 'register' ? (
        <form className="card form" onSubmit={(event) => void onRegister(event)}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {emailVerificationRequired ? (
            <p className="hint">
              After you register, open{' '}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                Mailpit
              </a>{' '}
              to copy the 6-digit code.
            </p>
          ) : null}
          <button type="submit" disabled={busy}>
            {emailVerificationRequired ? 'Send code' : 'Create account'}
          </button>
        </form>
      ) : null}

      {mode === 'verify' ? (
        <form className="card form" onSubmit={(event) => void onVerify(event)}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Verification code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          <p className="hint">
            Read the code in{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer">
              Mailpit at localhost:8025
            </a>
            .
          </p>
          <button type="submit" disabled={busy}>
            Verify and continue
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => goTo('login')}
          >
            Back to sign in
          </button>
        </form>
      ) : null}
    </div>
  )
}
