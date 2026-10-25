import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  MAX_COMMENTS,
  acceptableCount,
  checkAddedComments,
  codingProgress,
  filterCounts,
  filterItems,
  needsPersonCount,
  type ReviewFilter,
} from '../domain/batches.ts'
import { useBatch, useConsumer } from '../features/index.ts'
import { useAuth } from '../session/index.ts'
import {
  Badge,
  Button,
  Card,
  Heading,
  ProgressLine,
  Stack,
  Tab,
  TabList,
  Text,
  TextArea,
  TextLink,
} from '../ui/index.ts'
import { ReviewRow } from './ReviewRow.tsx'
import styles from './ReviewPage.module.css'

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs-you', label: 'Needs you' },
  { id: 'failed', label: 'Failed' },
]

const EMPTY_COPY: Record<ReviewFilter, string> = {
  all: 'This batch has no comments.',
  'needs-you': 'Nothing needs you right now.',
  failed: 'No comment failed.',
}

export function ReviewPage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const review = useBatch(batchId)
  const consumer = useConsumer()
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [draft, setDraft] = useState('')

  const { batch } = review

  if (!review.loaded) {
    return <Text tone="muted">Loading batch…</Text>
  }

  if (!batch) {
    return (
      <Stack>
        <TextLink to="/">&larr; Batches</TextLink>
        <Text tone="error">{review.error ?? 'This batch was not found.'}</Text>
      </Stack>
    )
  }

  const progress = codingProgress(batch.counts)
  const needsPerson = needsPersonCount(batch.counts)
  const counts = filterCounts(batch.items)
  const visible = filterItems(batch.items, filter)
  const acceptable = acceptableCount(batch.items)
  const added = checkAddedComments(batch.counts.total, draft)
  const filled = batch.counts.total + added.commentCount
  const error = review.error ?? consumer.error

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (added.problem) return
    if (await review.addComments(draft)) setDraft('')
  }

  function onDeleteItem(itemId: string) {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return
    void review.removeItem(itemId)
  }

  async function onDelete() {
    if (!window.confirm('Delete this batch and its comments? This cannot be undone.')) {
      return
    }
    if (await review.remove()) navigate('/', { replace: true })
  }

  return (
    <Stack>
      <Stack gap="sm">
        <TextLink to="/">&larr; Batches</TextLink>
        <Heading level={1}>{batch.title}</Heading>
        <div className={styles.chips}>
          {batch.tags.map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
        <Text tone="hint">Model: {batch.model}</Text>
      </Stack>

      <Card>
        <ProgressLine
          value={progress.done}
          max={progress.total}
          label={progress.text}
        />
        <div className={styles.status}>
          <Text tone="strong" as="span" aria-live="polite">
            {progress.text}
          </Text>
          <Text tone="muted" as="span">
            {batch.counts.tagged} of {batch.counts.total} tagged
          </Text>
          {needsPerson > 0 ? (
            <Badge tone="warning">
              {needsPerson} {needsPerson === 1 ? 'needs' : 'need'} a person
            </Badge>
          ) : null}
        </div>

        <div className={styles.status}>
          {consumer.running === null ? null : (
            <Text tone="strong" as="span">
              {consumer.running ? 'Coding' : 'Coding is paused'}
            </Text>
          )}
          {isAdmin && consumer.running !== null ? (
            <Button
              variant="secondary"
              disabled={consumer.busy}
              onClick={() => void consumer.toggle()}
            >
              {consumer.running ? 'Pause coding' : 'Resume coding'}
            </Button>
          ) : null}
          {consumer.running === false && !progress.finished ? (
            <Text tone="hint" as="span">
              Waiting comments stay put until an admin resumes coding.
            </Text>
          ) : null}
        </div>
      </Card>

      <Stack direction="row" gap="sm" align="center" wrap>
        <Button
          disabled={review.busy || acceptable === 0}
          onClick={() => void review.accept()}
        >
          Accept suggested{acceptable > 0 ? ` (${acceptable})` : ''}
        </Button>
        <Button
          variant="secondary"
          disabled={review.busy}
          onClick={() => void review.exportCsv()}
        >
          Export CSV
        </Button>
        {isAdmin ? (
          <Button
            variant="danger"
            disabled={review.busy}
            onClick={() => void onDelete()}
          >
            Delete batch
          </Button>
        ) : null}
      </Stack>

      <Card>
        <form onSubmit={(event) => void onAdd(event)}>
          <Stack gap="md">
            <TextArea
              label="Add comments, one per line"
              name="comments"
              rows={4}
              placeholder={'The delivery arrived two days late.\nPlease add a dark mode.'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Text tone={filled > MAX_COMMENTS ? 'error' : 'hint'} aria-live="polite">
              {filled} of {MAX_COMMENTS} comments
              {filled > MAX_COMMENTS ? ` — remove ${filled - MAX_COMMENTS}` : ''}
            </Text>
            {draft && added.problem && filled <= MAX_COMMENTS ? (
              <Text tone="hint">{added.problem}</Text>
            ) : null}
            <Button type="submit" disabled={review.busy || added.problem !== null}>
              Add comments
            </Button>
          </Stack>
        </form>
      </Card>

      {error ? <Text tone="error">{error}</Text> : null}
      {review.notice ? <Text tone="hint">{review.notice}</Text> : null}

      <TabList aria-label="Filter comments">
        {FILTERS.map(({ id, label }) => (
          <Tab
            key={id}
            selected={filter === id}
            count={counts[id]}
            onClick={() => setFilter(id)}
          >
            {label}
          </Tab>
        ))}
      </TabList>

      {visible.length === 0 ? (
        <Text tone="muted">{EMPTY_COPY[filter]}</Text>
      ) : (
        <div className={styles.rows}>
          {visible.map((item) => (
            <ReviewRow
              key={item.id}
              batchId={batch.id}
              item={item}
              tags={batch.tags}
              disabled={review.busy}
              onRetag={(itemId, finalTag) => void review.retag(itemId, finalTag)}
              onDelete={onDeleteItem}
            />
          ))}
        </div>
      )}
    </Stack>
  )
}
