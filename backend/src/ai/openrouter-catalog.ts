export type OpenRouterModelChoice = {
  id: string;
  name: string;
  description: string;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
};

type Pricing = {
  prompt?: unknown;
  completion?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFreePrice(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '' && Number(value) === 0;
}

function readText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readModalities(architecture: unknown): string[] {
  if (!isRecord(architecture) || !Array.isArray(architecture.input_modalities)) {
    return [];
  }
  return architecture.input_modalities.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
}

function readIndex(benchmarks: unknown, key: string): number | null {
  if (!isRecord(benchmarks) || !isRecord(benchmarks.artificial_analysis)) {
    return null;
  }
  return readNumber(benchmarks.artificial_analysis[key]);
}

export function freeOpenRouterModels(payload: unknown): OpenRouterModelChoice[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('OpenRouter model list was not recognized');
  }

  const models: OpenRouterModelChoice[] = [];
  for (const item of payload.data) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    const id = item.id.trim();
    if (!id) continue;
    const pricing: Pricing | null = isRecord(item.pricing) ? item.pricing : null;
    if (
      !pricing ||
      !isFreePrice(pricing.prompt) ||
      !isFreePrice(pricing.completion)
    ) {
      continue;
    }
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const provider = isRecord(item.top_provider) ? item.top_provider : null;
    models.push({
      id,
      name: name || id,
      description: readText(item.description, 320),
      contextLength: readNumber(item.context_length),
      maxOutputTokens: provider
        ? readNumber(provider.max_completion_tokens)
        : null,
      inputModalities: readModalities(item.architecture),
      intelligenceIndex: readIndex(item.benchmarks, 'intelligence_index'),
      codingIndex: readIndex(item.benchmarks, 'coding_index'),
      agenticIndex: readIndex(item.benchmarks, 'agentic_index'),
    });
  }

  models.sort((left, right) => left.name.localeCompare(right.name));
  return models;
}
