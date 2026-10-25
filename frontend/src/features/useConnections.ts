import { useCallback, useEffect, useState } from 'react'
import {
  getSettings,
  listConnections,
  testConnection,
  updateSettings,
} from '../api/index.ts'
import { replaceConnection } from '../domain/admin.ts'
import { errorMessage } from '../domain/errors.ts'
import type {
  ConnectionTool,
  ConnectionView,
  SettingsUpdate,
  SettingsView,
} from '../domain/types.ts'

/** Connection states and the Test action. Details never include secrets. */
export function useConnections() {
  const [connections, setConnections] = useState<ConnectionView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<ConnectionTool | null>(null)

  useEffect(() => {
    let cancelled = false
    void listConnections()
      .then((next) => {
        if (!cancelled) setConnections(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load connections'))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function test(tool: ConnectionTool) {
    setTesting(tool)
    setError(null)
    try {
      const next = await testConnection(tool)
      setConnections((current) => replaceConnection(current, next))
    } catch (err) {
      setError(errorMessage(err, 'The test could not run'))
    } finally {
      setTesting(null)
    }
  }

  return { connections, loaded, error, testing, test }
}

/** Model allowlist and keep period. Both are non-secret. */
export function useSettings() {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getSettings()
      .then((next) => {
        if (!cancelled) setSettings(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load settings'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async (patch: SettingsUpdate) => {
    setSaving(true)
    setError(null)
    try {
      setSettings(await updateSettings(patch))
      return true
    } catch (err) {
      setError(errorMessage(err, 'Could not save settings'))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { settings, error, saving, save }
}
