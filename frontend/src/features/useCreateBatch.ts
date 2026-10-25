import { useState } from 'react'
import { createBatch } from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'
import type { NewBatchInput } from '../domain/types.ts'

export function useCreateBatch() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Resolves to the new batch id, or null when the server refused it. */
  async function create(input: NewBatchInput): Promise<string | null> {
    setBusy(true)
    setError(null)
    try {
      const batch = await createBatch({
        ...input,
        title: input.title.trim(),
      })
      return batch.id
    } catch (err) {
      setError(errorMessage(err, 'Could not create the batch'))
      return null
    } finally {
      setBusy(false)
    }
  }

  return { create, busy, error }
}
