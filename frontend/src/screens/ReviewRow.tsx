import { STATUS_LABEL } from '../domain/batches.ts'
import type { BatchItem, ItemStatus } from '../domain/types.ts'
import {
  Badge,
  Button,
  cx,
  LinkButton,
  Select,
  Text,
  type BadgeTone,
} from '../ui/index.ts'
import styles from './ReviewRow.module.css'

const STATUS_TONE: Record<ItemStatus, BadgeTone> = {
  queued: 'neutral',
  coded: 'info',
  needs_review: 'warning',
  failed: 'danger',
}

type ReviewRowProps = {
  batchId: string
  item: BatchItem
  tags: string[]
  disabled: boolean
  onRetag: (itemId: string, finalTag: string) => void
  onDelete: (itemId: string) => void
}

/**
 * One comment. The grid is a row on desktop and a stacked card on a narrow
 * viewport; the markup and the data are the same.
 */
export function ReviewRow({
  batchId,
  item,
  tags,
  disabled,
  onRetag,
  onDelete,
}: ReviewRowProps) {
  const needsYou = item.status === 'needs_review' && !item.finalTag
  const options = [
    { value: '', label: 'Choose a tag' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ]

  return (
    <article
      className={cx(
        styles.row,
        needsYou && styles.rowNeedsYou,
        item.status === 'failed' && styles.rowFailed,
      )}
    >
      <span className={styles.position}>{item.position}</span>

      <div className={styles.comment}>
        <p className={styles.commentText}>{item.text}</p>
        {item.summary ? <p className={styles.summary}>{item.summary}</p> : null}
        {item.status === 'failed' ? (
          <Text tone="error">
            {item.failedReason ?? 'This comment could not be coded.'}
          </Text>
        ) : null}
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
      </div>

      <div className={styles.cell}>
        <span className={styles.cellLabel}>Suggested tag</span>
        <span className={styles.suggested}>
          {item.suggestedTag ??
            (item.status === 'queued' ? 'Waiting to be coded' : 'None')}
        </span>
      </div>

      <div className={styles.cell}>
        <Select
          label="Final tag"
          value={item.finalTag ?? ''}
          options={options}
          disabled={disabled || item.status === 'queued'}
          onChange={(event) => onRetag(item.id, event.target.value)}
        />
      </div>

      <div className={cx(styles.cell, styles.ask)}>
        {item.conversationId ? (
          <LinkButton
            variant="secondary"
            to={`/batches/${batchId}/items/${item.id}/ask`}
          >
            Ask
          </LinkButton>
        ) : (
          <Button
            variant="secondary"
            disabled
            title="Available once this comment has been coded"
          >
            Ask
          </Button>
        )}
        <Button
          variant="danger"
          disabled={disabled}
          onClick={() => onDelete(item.id)}
        >
          Delete
        </Button>
      </div>
    </article>
  )
}
