import { lazy, Suspense, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { useAsk } from '../features/index.ts'
import {
  Button,
  Card,
  cx,
  Heading,
  Stack,
  Text,
  TextArea,
  TextLink,
} from '../ui/index.ts'
import styles from './AskPage.module.css'

const MessageContent = lazy(() =>
  import('../ui/markdown/MessageContent.tsx').then((module) => ({
    default: module.MessageContent,
  })),
)

export function AskPage() {
  const { batchId, itemId } = useParams()
  const ask = useAsk(batchId, itemId)
  const [draft, setDraft] = useState('')

  const backTo = batchId ? `/batches/${batchId}` : '/'
  const visibleMessages =
    ask.thread?.messages.filter((message) => message.role !== 'system') ?? []

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await ask.send(draft)) setDraft('')
  }

  if (!ask.loaded) {
    return <Text tone="muted">Opening conversation…</Text>
  }

  return (
    <Stack>
      <Stack gap="sm">
        <TextLink to={backTo}>
          &larr; Back to {ask.batchTitle ?? 'the batch'}
        </TextLink>
        <Heading level={1}>Ask about this comment</Heading>
      </Stack>

      {ask.item ? (
        <Card>
          <Text tone="hint">
            Comment {ask.item.position}
            {ask.item.finalTag ? ` · Final tag: ${ask.item.finalTag}` : ''}
            {ask.item.suggestedTag
              ? ` · Suggested tag: ${ask.item.suggestedTag}`
              : ''}
          </Text>
          <p className={styles.comment}>{ask.item.text}</p>
        </Card>
      ) : null}

      {ask.error ? <Text tone="error">{ask.error}</Text> : null}

      {ask.thread ? (
        <>
          <Stack gap="md">
            {visibleMessages.map((message) => (
              <article
                key={message.id}
                className={cx(
                  styles.bubble,
                  message.role === 'assistant'
                    ? styles.bubbleAssistant
                    : styles.bubbleUser,
                )}
              >
                <p className={styles.role}>
                  {message.role === 'user' ? 'Comment / you' : 'Assistant'}
                </p>
                {message.role === 'assistant' ? (
                  <Suspense fallback={<Text tone="muted">Loading reply…</Text>}>
                    <MessageContent content={message.content} />
                  </Suspense>
                ) : (
                  <p className={styles.plain}>{message.content}</p>
                )}
              </article>
            ))}
          </Stack>

          <Card>
            <form onSubmit={(event) => void onSend(event)}>
              <Stack gap="md">
                <TextArea
                  label="Your question"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  required
                />
                <Text tone="hint">
                  A reply does not retag this row. Change the final tag on the
                  batch screen.
                </Text>
                <Button type="submit" disabled={ask.sending || !draft.trim()}>
                  {ask.sending ? 'Sending…' : 'Send'}
                </Button>
              </Stack>
            </form>
          </Card>
        </>
      ) : null}
    </Stack>
  )
}
