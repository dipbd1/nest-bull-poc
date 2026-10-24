import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router'
import {
  getConsumerStatus,
  getConversation,
  listConversations,
  sendConversationMessage,
  setConsumerRunning,
} from '../api.ts'
import type {
  ConversationDetail,
  ConversationSummary,
  LayoutContext,
} from '../types.ts'

const POLL_MS = 3000

export function ConsumersPage() {
  const { refreshStatus } = useOutletContext<LayoutContext>()
  const [running, setRunning] = useState<boolean | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<ConversationDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)

  async function reloadConversations() {
    const next = await listConversations()
    setConversations(next)
  }

  useEffect(() => {
    let cancelled = false
    void getConsumerStatus()
      .then((status) => {
        if (!cancelled) setRunning(status.running)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load consumer status',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function refreshList() {
      try {
        const next = await listConversations()
        if (!cancelled) {
          setConversations(next)
          setError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load conversations',
          )
        }
      }
    }
    void refreshList()
    const timer = window.setInterval(() => {
      void refreshList()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    void getConversation(selectedId)
      .then((detail) => {
        if (!cancelled) setThread(detail)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load conversation',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function onToggle() {
    if (running === null) return
    setBusy(true)
    setError(null)
    try {
      const status = await setConsumerRunning(!running)
      setRunning(status.running)
      await refreshStatus()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update consumer',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !draft.trim()) return
    setSending(true)
    setError(null)
    try {
      const next = await sendConversationMessage(selectedId, draft.trim())
      setThread(next)
      setDraft('')
      await reloadConversations()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send message',
      )
    } finally {
      setSending(false)
    }
  }

  const label =
    running === null
      ? 'Checking worker…'
      : running
        ? 'Turn consumers off'
        : 'Turn consumers on'

  const openThread = thread?.id === selectedId ? thread : null
  const visibleMessages =
    openThread?.messages.filter((message) => message.role !== 'system') ?? []

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Consumers</h1>
          <p className="muted">
            Pause or resume the queue worker, then continue processed job chats.
          </p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="card consumer-card">
        <p className="consumer-state">
          {running === null
            ? 'Worker status unknown'
            : running
              ? 'Worker is running'
              : 'Worker is paused'}
        </p>
        <button
          type="button"
          className={running ? 'danger' : undefined}
          onClick={() => void onToggle()}
          disabled={busy || running === null}
        >
          {label}
        </button>
      </div>

      <div className="chat-layout">
        <div className="card chat-list">
          <h2>Processed jobs</h2>
          {conversations.length === 0 ? (
            <p className="muted">No processed jobs yet.</p>
          ) : (
            <ul>
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={
                      conversation.id === selectedId
                        ? 'chat-item active'
                        : 'chat-item'
                    }
                    onClick={() => setSelectedId(conversation.id)}
                  >
                    <span className="chat-item-title">{conversation.title}</span>
                    <span className="muted">{conversation.model}</span>
                    <span className="chat-item-preview">
                      {conversation.preview ?? 'No reply yet'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card chat-thread">
          {openThread ? (
            <>
              <header className="chat-thread-header">
                <h2>{openThread.title}</h2>
                <p className="muted">
                  {openThread.provider} · {openThread.model}
                </p>
              </header>
              <div className="chat-messages">
                {visibleMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-bubble chat-bubble-${message.role}`}
                  >
                    <p className="chat-role">
                      {message.role === 'user' ? 'Job / you' : 'Assistant'}
                    </p>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
              <form className="chat-composer" onSubmit={(event) => void onSend(event)}>
                <label>
                  Continue this chat
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                    required
                  />
                </label>
                <button type="submit" disabled={sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <p className="muted">Select a processed job to read and continue the chat.</p>
          )}
        </div>
      </div>
    </section>
  )
}
