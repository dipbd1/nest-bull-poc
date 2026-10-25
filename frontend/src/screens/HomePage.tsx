import { Link } from 'react-router'
import { formatDate } from '../domain/admin.ts'
import { codingProgress, needsPersonCount } from '../domain/batches.ts'
import type { BatchSummary } from '../domain/types.ts'
import { useBatches } from '../features/index.ts'
import {
  Badge,
  Card,
  Heading,
  LinkButton,
  ProgressLine,
  Stack,
  Text,
} from '../ui/index.ts'
import styles from './HomePage.module.css'

const EXAMPLE_TAGS = 'Shipping, Support, Feature request'
const EXAMPLE_COMMENTS = [
  'The delivery arrived two days late.',
  'Support fixed my billing issue in minutes.',
  'Please add a dark mode.',
].join('\n')

function BatchCard({ batch }: { batch: BatchSummary }) {
  const progress = codingProgress(batch.counts)
  const needsPerson = needsPersonCount(batch.counts)

  return (
    <Link to={`/batches/${batch.id}`} className={styles.cardLink}>
      <Stack gap="xs">
        <span className={styles.title}>{batch.title}</span>
        <Text tone="hint">
          {formatDate(batch.createdAt)} · {batch.counts.total} comments
        </Text>
      </Stack>
      <ProgressLine
        value={progress.done}
        max={progress.total}
        label={progress.text}
      />
      <Stack direction="row" gap="sm" align="center" wrap>
        <Text tone="strong" as="span">
          {progress.text}
        </Text>
        {needsPerson > 0 ? (
          <Badge tone="warning">
            {needsPerson} {needsPerson === 1 ? 'needs' : 'need'} a person
          </Badge>
        ) : progress.finished ? (
          <Badge tone="success">Nothing needs you</Badge>
        ) : null}
      </Stack>
      <Text tone="hint">
        {batch.counts.tagged} of {batch.counts.total} tagged
      </Text>
    </Link>
  )
}

export function HomePage() {
  const { batches, loaded, error } = useBatches()

  return (
    <Stack>
      <Stack direction="row" justify="between" align="center" wrap>
        <Stack gap="xs">
          <Heading level={1}>Batches</Heading>
          <Text tone="muted">
            Paste comments, let them be tagged, fix what needs you, export.
          </Text>
        </Stack>
        <LinkButton to="/batches/new">New batch</LinkButton>
      </Stack>

      {error ? <Text tone="error">{error}</Text> : null}

      {!loaded ? <Text tone="muted">Loading batches…</Text> : null}

      {loaded && batches.length === 0 && !error ? (
        <Card>
          <Heading>Start with a few comments</Heading>
          <Text tone="muted">
            Give the batch a title and two or more tags, then paste one comment
            per line. For example:
          </Text>
          <Text tone="hint">Tags: {EXAMPLE_TAGS}</Text>
          <pre className={styles.example}>{EXAMPLE_COMMENTS}</pre>
          <LinkButton to="/batches/new">New batch</LinkButton>
        </Card>
      ) : null}

      {batches.length > 0 ? (
        <div className={styles.cards}>
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      ) : null}
    </Stack>
  )
}
