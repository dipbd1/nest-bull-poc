import type { CodingModel } from './types.ts'

export function readsAndWritesText(model: CodingModel): boolean {
  return (
    model.inputModalities.includes('text') &&
    model.outputModalities.includes('text')
  )
}

export function formatTokens(value: number | null): string {
  if (value === null) return 'not listed'
  if (value >= 1_000_000 && value % 1_000_000 === 0) return `${value / 1_000_000}M`
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}k`
  return value.toLocaleString('en-US')
}

export function scoreText(value: number | null): string {
  return value === null ? 'not scored' : String(value)
}

/** Compact facts for one row. Scores appear only when OpenRouter published them. */
export function modelFactLine(model: CodingModel): string {
  const parts = [`${formatTokens(model.contextLength)} context`]
  if (model.intelligenceIndex !== null) {
    parts.push(`intelligence ${model.intelligenceIndex}`)
  }
  if (model.codingIndex !== null) parts.push(`coding ${model.codingIndex}`)
  if (model.agenticIndex !== null) parts.push(`agent ${model.agenticIndex}`)
  parts.push(model.supportsStructuredOutput ? 'JSON' : 'No JSON output listed')
  if (model.inputModalities.length > 0) parts.push(model.inputModalities.join(', '))
  return parts.join(' · ')
}

export function matchesModelQuery(model: CodingModel, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [model.name, model.id, model.description].some((part) =>
    part.toLowerCase().includes(needle),
  )
}

export function chosenModelId(
  models: CodingModel[],
  picked: string,
  fallback: string,
): string {
  if (models.some((model) => model.id === picked)) return picked
  if (models.some((model) => model.id === fallback)) return fallback
  return models.find((model) => readsAndWritesText(model))?.id ?? models[0]?.id ?? ''
}
