import { useEffect, useState } from 'react'
import {
  getBatch,
  getConversation,
  sendConversationMessage,
} from '../api/index.ts'
import { errorMessage } from '../domain/errors.ts'
import type { BatchItem, ConversationDetail } from '../domain/types.ts'

/** The saved thread for one comment, plus the follow-up composer. */
export function useAsk(batchId: string | undefined, itemId: string | undefined) {
  const [batchTitle, setBatchTitle] = useState<string | null>(null)
  const [item, setItem] = useState<BatchItem | null>(null)
  const [thread, setThread] = useState<ConversationDetail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!batchId || !itemId) return
    let cancelled = false

    async function load(id: string, rowId: string) {
      try {
        const batch = await getBatch(id)
        if (cancelled) return
        const row = batch.items.find((candidate) => candidate.id === rowId) ?? null
        setBatchTitle(batch.title)
        setItem(row)
        if (!row) {
          setError('That comment is not in this batch.')
        } else if (!row.conversationId) {
          setError('This comment has no conversation yet.')
        } else {
          const detail = await getConversation(row.conversationId)
          if (!cancelled) setThread(detail)
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Could not open this conversation'))
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void load(batchId, itemId)
    return () => {
      cancelled = true
    }
  }, [batchId, itemId])

  /** Resolves true when the reply was saved. The row's tag is never touched. */
  async function send(content: string) {
    const conversationId = item?.conversationId
    const text = content.trim()
    if (!conversationId || !text) return false
    setSending(true)
    setError(null)
    try {
      setThread(await sendConversationMessage(conversationId, text))
      return true
    } catch (err) {
      setError(errorMessage(err, 'Could not send your message'))
      return false
    } finally {
      setSending(false)
    }
  }

  return { batchTitle, item, thread, loaded, error, sending, send }
}
