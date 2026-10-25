import { useState } from 'react'
import { getModelDescription } from '../api/batches.ts'
import {
  formatTokens,
  matchesModelQuery,
  modelFactLine,
  readsAndWritesText,
  scoreText,
} from '../domain/models.ts'
import type { CodingModel } from '../domain/types.ts'
import { cx, Text, TextField } from '../ui/index.ts'
import styles from './ModelField.module.css'

type ModelFieldProps = {
  models: CodingModel[]
  value: string
  loaded: boolean
  onChange: (id: string) => void
}

export function ModelField({ models, value, loaded, onChange }: ModelFieldProps) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const shown = models.filter((model) => matchesModelQuery(model, filter))

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>Model</legend>
      <Text tone="hint">
        This batch asks the model to choose one of your tags and write a short
        summary. A higher intelligence score usually follows that more reliably.
        Coding and agent scores matter less here. JSON output is what the coder
        needs.
      </Text>
      {!loaded ? <Text tone="muted">Loading…</Text> : null}
      <TextField
        label="Filter models"
        name="modelFilter"
        value={filter}
        placeholder="Name, id, or description"
        disabled={!loaded || models.length === 0}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className={styles.list} role="radiogroup" aria-label="Free OpenRouter models">
        {shown.map((model, index) => (
          <ModelOption
            key={model.id}
            model={model}
            index={index}
            picked={model.id === value}
            expanded={open.has(model.id)}
            onChange={onChange}
            onToggle={() => toggle(model.id)}
          />
        ))}
        {loaded && models.length > 0 && shown.length === 0 ? (
          <Text tone="muted">No model matches.</Text>
        ) : null}
        {loaded && models.length === 0 ? <Text tone="muted">No model available</Text> : null}
      </div>
    </fieldset>
  )
}

function descriptionIsCut(text: string): boolean {
  return text.endsWith('...') || text.endsWith('…')
}

function ModelOption({
  model,
  index,
  picked,
  expanded,
  onChange,
  onToggle,
}: {
  model: CodingModel
  index: number
  picked: boolean
  expanded: boolean
  onChange: (id: string) => void
  onToggle: () => void
}) {
  const usable = readsAndWritesText(model)
  const detailsId = `model-details-${index}`
  const reads =
    model.inputModalities.length > 0 ? model.inputModalities.join(', ') : 'not listed'
  const cut = descriptionIsCut(model.description)
  const [full, setFull] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function onDetailsClick() {
    if (!expanded && cut && !full && !loading) {
      setLoading(true)
      getModelDescription(model.id)
        .then((result) => setFull(result.description))
        .catch(() => setFull(null))
        .finally(() => setLoading(false))
    }
    onToggle()
  }

  return (
    <div className={cx(styles.option, picked && styles.picked, !usable && styles.blocked)}>
      <label className={styles.choice}>
        <input
          type="radio"
          name="model"
          value={model.id}
          checked={picked}
          disabled={!usable}
          onChange={() => onChange(model.id)}
        />
        <span className={styles.copy}>
          <span className={styles.name}>{model.name}</span>
          <span className={styles.id}>{model.id}</span>
          <span className={styles.facts}>{modelFactLine(model)}</span>
          {usable ? null : (
            <span className={styles.facts}>Does not read and write text.</span>
          )}
        </span>
      </label>
      <button
        type="button"
        className={styles.details}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onDetailsClick}
      >
        {expanded ? 'Hide details' : 'Details'}
      </button>
      {expanded ? (
        <div id={detailsId} className={styles.more}>
          {full || model.description ? (
            <p className={styles.description}>{full ?? model.description}</p>
          ) : null}
          {loading && !full ? (
            <Text tone="hint">Loading the rest of the description…</Text>
          ) : null}
          <Text tone="hint">
            {`Context ${formatTokens(model.contextLength)}. Max output ${formatTokens(model.maxOutputTokens)}. Reads ${reads}.`}
          </Text>
          <Text tone="hint">
            {`Intelligence ${scoreText(model.intelligenceIndex)}. Coding ${scoreText(model.codingIndex)}. Agent ${scoreText(model.agenticIndex)}.`}
          </Text>
          <Text tone="hint">
            {model.supportsStructuredOutput
              ? 'Returns JSON.'
              : 'JSON output not listed, so tags may come back for review.'}
          </Text>
        </div>
      ) : null}
    </div>
  )
}
