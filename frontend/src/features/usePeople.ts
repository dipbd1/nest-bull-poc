import { useCallback, useEffect, useState } from 'react'
import {
  listInvites,
  listPeople,
  sendInvite,
  updatePerson,
} from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'
import type { InviteView, PersonView, UserRole } from '../domain/types.ts'

export function usePeople() {
  const [people, setPeople] = useState<PersonView[]>([])
  const [invites, setInvites] = useState<InviteView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [nextPeople, nextInvites] = await Promise.all([
        listPeople(),
        listInvites(),
      ])
      setPeople(nextPeople)
      setInvites(nextInvites)
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'Could not load people'))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([listPeople(), listInvites()])
      .then(([nextPeople, nextInvites]) => {
        if (cancelled) return
        setPeople(nextPeople)
        setInvites(nextInvites)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load people'))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(errorMessage(err, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function invite(email: string, role: UserRole) {
    const ok = await run(() => sendInvite(email.trim(), role), 'Could not send the invite')
    if (ok) setNotice(`Invite sent to ${email.trim()}.`)
    return ok
  }

  function setDisabled(id: string, disabled: boolean) {
    return run(
      () => updatePerson(id, { disabled }),
      disabled ? 'Could not disable this person' : 'Could not enable this person',
    )
  }

  return { people, invites, loaded, error, notice, busy, invite, setDisabled }
}
