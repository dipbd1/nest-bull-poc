import { useEffect, useState } from 'react'
import { getConsumerStatus, setConsumerRunning } from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'

/** Whether coding is running. Admins can pause and resume it. */
export function useConsumer() {
  const [running, setRunning] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getConsumerStatus()
      .then((status) => {
        if (!cancelled) setRunning(status.running)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err, 'Could not check whether coding is running'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle() {
    if (running === null) return
    setBusy(true)
    setError(null)
    try {
      const status = await setConsumerRunning(!running)
      setRunning(status.running)
    } catch (err) {
      setError(errorMessage(err, 'Could not change coding'))
    } finally {
      setBusy(false)
    }
  }

  return { running, busy, error, toggle }
}
