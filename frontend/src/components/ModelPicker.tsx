import { useEffect, useId, useRef, useState } from 'react'
import type { FreeModel } from '../types.ts'

const HOVER_DELAY_MS = 420

type ModelPickerProps = {
  label: string
  models: FreeModel[]
  value: string
  onChange: (modelId: string) => void
}

type PopoverPlace = {
  top: number
  left: number
  width: number
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10
    return `${rounded}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

function contextTone(value: number): string {
  if (value >= 256_000) return 'model-chip-context-lg'
  if (value >= 64_000) return 'model-chip-context-md'
  return 'model-chip-context-sm'
}

function scoreTone(value: number): string {
  if (value >= 40) return 'model-chip-score-high'
  if (value >= 20) return 'model-chip-score-mid'
  return 'model-chip-score-low'
}

function placePopover(row: HTMLElement): PopoverPlace {
  const rect = row.getBoundingClientRect()
  const margin = 8
  const width = 300
  const height = 300
  const spaceRight = window.innerWidth - rect.right - margin
  const spaceLeft = rect.left - margin
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin))
  if (spaceRight >= width) {
    return { top, left: rect.right + margin, width }
  }
  if (spaceLeft >= width) {
    return { top, left: rect.left - width - margin, width }
  }
  const menu = row.closest('.model-picker-menu')?.getBoundingClientRect()
  return {
    top: Math.max(margin, window.innerHeight - height - margin),
    left: menu?.left ?? margin,
    width: Math.min(menu?.width ?? width, window.innerWidth - margin * 2),
  }
}

function ModelDetails({ model }: { model: FreeModel }) {
  const scores = [
    ['Intelligence', model.intelligenceIndex],
    ['Coding', model.codingIndex],
    ['Agents', model.agenticIndex],
  ] as const

  return (
    <div className="model-popover-body">
      <p className="model-popover-name">{model.name}</p>
      <p className="model-popover-id">{model.id}</p>
      {model.description ? <p className="model-popover-copy">{model.description}</p> : null}
      <div className="model-chip-row">
        <span className="model-chip model-chip-free">Free</span>
        {model.contextLength !== null ? (
          <span className={`model-chip ${contextTone(model.contextLength)}`}>
            {formatTokens(model.contextLength)} context
          </span>
        ) : null}
        {model.maxOutputTokens !== null ? (
          <span className="model-chip model-chip-output">
            {formatTokens(model.maxOutputTokens)} output
          </span>
        ) : null}
        {model.inputModalities.map((modality) => (
          <span key={modality} className="model-chip model-chip-modality">
            {modality}
          </span>
        ))}
      </div>
      {scores.some(([, value]) => value !== null) ? (
        <div className="model-chip-row">
          {scores.map(([label, value]) =>
            value === null ? null : (
              <span key={label} className={`model-chip ${scoreTone(value)}`}>
                {label} {value}
              </span>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

export function ModelPicker({ label, models, value, onChange }: ModelPickerProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | null>(null)
  const hideTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<FreeModel | null>(null)
  const [place, setPlace] = useState<PopoverPlace | null>(null)
  const selected = models.find((model) => model.id === value) ?? null

  function clearHover() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function hidePreview() {
    clearHover()
    setPreview(null)
    setPlace(null)
  }

  function scheduleHide() {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      setPreview(null)
      setPlace(null)
    }, 140)
  }

  function close() {
    setOpen(false)
    hidePreview()
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => () => clearHover(), [])

  function onRowEnter(model: FreeModel, row: HTMLButtonElement) {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      setPreview(model)
      setPlace(placePopover(row))
    }, HOVER_DELAY_MS)
  }

  return (
    <div className="model-picker" ref={rootRef}>
      <span className="model-picker-label">{label}</span>
      <button
        type="button"
        className="model-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={models.length === 0}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{selected?.name ?? (models.length === 0 ? 'No free models available' : 'Choose a model')}</span>
        <span className="model-picker-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="model-picker-menu"
          role="listbox"
          onScroll={hidePreview}
        >
          {models.map((model) => (
            <li key={model.id}>
              <button
                type="button"
                role="option"
                aria-selected={model.id === value}
                className={
                  model.id === value ? 'model-option is-selected' : 'model-option'
                }
                onMouseEnter={(event) => onRowEnter(model, event.currentTarget)}
                onMouseLeave={scheduleHide}
                onFocus={(event) => onRowEnter(model, event.currentTarget)}
                onBlur={hidePreview}
                onClick={() => {
                  onChange(model.id)
                  close()
                }}
              >
                <span className="model-option-name">{model.name}</span>
                <span className="model-option-meta">
                  {model.contextLength !== null
                    ? `${formatTokens(model.contextLength)} context`
                    : model.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && preview && place ? (
        <div
          className="model-popover"
          style={{ top: place.top, left: place.left, width: place.width }}
          role="tooltip"
          onMouseEnter={() => {
            if (hideTimer.current !== null) {
              window.clearTimeout(hideTimer.current)
              hideTimer.current = null
            }
          }}
          onMouseLeave={scheduleHide}
        >
          <ModelDetails model={preview} />
        </div>
      ) : null}
    </div>
  )
}
