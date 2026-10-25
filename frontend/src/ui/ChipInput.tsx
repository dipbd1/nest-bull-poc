import { useState, type KeyboardEvent } from 'react'
import styles from './ChipInput.module.css'
import field from './field.module.css'

type ChipInputProps = {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxChips?: number
  maxLength?: number
  disabled?: boolean
}

export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  maxChips,
  maxLength,
  disabled,
}: ChipInputProps) {
  const [draft, setDraft] = useState('')
  const full = maxChips !== undefined && values.length >= maxChips

  function commit() {
    const next = draft.trim()
    setDraft('')
    if (!next || full || values.includes(next)) return
    onChange([...values, next])
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <label className={field.label}>
      {label}
      <span className={styles.box}>
        {values.map((value) => (
          <span key={value} className={styles.chip}>
            {value}
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${value}`}
              disabled={disabled}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className={styles.input}
          value={draft}
          disabled={disabled || full}
          maxLength={maxLength}
          placeholder={values.length === 0 ? placeholder : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      </span>
    </label>
  )
}
