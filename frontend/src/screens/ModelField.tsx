import { useState } from 'react'
import {
  matchesModelQuery,
  modelFactLine,
  readsAndWritesText,
  scoreText,
  formatTokens,
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
  const selected = models.find((model) => model.id === value) ?? null
  const shown = models.filter((model) => matchesModelQuery(model, filter))

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>Model</legend>
      <Text tone="hint">
        This batch asks the model to choose one of your tags and write a short
        summary. A higher intelligence score usually follows that more reliably.
        Coding and agent scores matter less here. JSON output is what the coder
        needs.
      </Text>
      {selected ? <SelectedModel model={selected} /> : null}
      {!selected && !loaded ? <Text tone="muted">Loading…</Text> : null}
      <TextField
        label="Filter models"
        name="modelFilter"
        value={filter}
        placeholder="Name, id, or description"
        disabled={!loaded || models.length === 0}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className={styles.list} role="radiogroup" aria-label="Free OpenRouter models">
        {shown.map((model) => {
          const usable = readsAndWritesText(model)
          const picked = model.id === value
          return (
            <label
              key={model.id}
              className={cx(styles.option, picked && styles.picked, !usable && styles.blocked)}
            >
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
                {model.description ? (
                  <span className={styles.description}>{model.description}</span>
                ) : null}
                {usable ? null : (
                  <span className={styles.facts}>Does not read and write text.</span>
                )}
              </span>
            </label>
          )
        })}
        {loaded && models.length > 0 && shown.length === 0 ? (
          <Text tone="muted">No model matches.</Text>
        ) : null}
        {loaded && models.length === 0 ? <Text tone="muted">No model available</Text> : null}
      </div>
    </fieldset>
  )
}

function SelectedModel({ model }: { model: CodingModel }) {
  const reads = model.inputModalities.length > 0 ? model.inputModalities.join(', ') : 'not listed'
  return (
    <div className={styles.detail}>
      <Text tone="strong">{model.name}</Text>
      <p className={styles.id}>{model.id}</p>
      {model.description ? <Text>{model.description}</Text> : null}
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
      {readsAndWritesText(model) ? null : (
        <Text tone="error">Does not read and write text.</Text>
      )}
    </div>
  )
}
