export type OpenRouterModelChoice = {
  id: string;
  name: string;
  description: string;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsStructuredOutput: boolean;
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
};

export const OPENROUTER_NOT_CONNECTED = 'OpenRouter is not connected';

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

function readModalities(architecture: unknown, key: string): string[] {
  if (!isRecord(architecture) || !Array.isArray(architecture[key])) {
    return [];
  }
  return architecture[key].filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
}

function readsStructuredOutput(parameters: unknown): boolean {
  if (!Array.isArray(parameters)) return false;
  return parameters.some(
    (item) => item === 'response_format' || item === 'structured_outputs',
  );
}

/** A comment coder needs a model that can read the comment and write the tag. */
export function readsAndWritesText(model: OpenRouterModelChoice): boolean {
  return (
    model.inputModalities.includes('text') &&
    model.outputModalities.includes('text')
  );
}

function codingGroup(model: OpenRouterModelChoice): number {
  if (!readsAndWritesText(model)) return 2;
  return model.supportsStructuredOutput ? 0 : 1;
}

/** JSON-capable text models first, highest intelligence first, then the rest. */
export function rankFreeModels(
  models: OpenRouterModelChoice[],
): OpenRouterModelChoice[] {
  return [...models].sort((left, right) => {
    const group = codingGroup(left) - codingGroup(right);
    if (group !== 0) return group;
    const intelligence =
      (right.intelligenceIndex ?? -1) - (left.intelligenceIndex ?? -1);
    if (intelligence !== 0) return intelligence;
    return left.name.localeCompare(right.name);
  });
}

/**
 * The env model when it is actually free. Otherwise the best text model that
 * reports JSON output.
 */
export function suggestedFreeModel(
  models: OpenRouterModelChoice[],
  preferredId: string,
): string {
  const preferred = preferredId.trim();
  if (preferred && models.some((model) => model.id === preferred)) {
    return preferred;
  }
  const ranked = rankFreeModels(models);
  const best = ranked.find(
    (model) => readsAndWritesText(model) && model.supportsStructuredOutput,
  );
  return (
    best?.id ??
    ranked.find((model) => readsAndWritesText(model))?.id ??
    ranked[0]?.id ??
    ''
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
      inputModalities: readModalities(item.architecture, 'input_modalities'),
      outputModalities: readModalities(item.architecture, 'output_modalities'),
      supportsStructuredOutput: readsStructuredOutput(item.supported_parameters),
      intelligenceIndex: readIndex(item.benchmarks, 'intelligence_index'),
      codingIndex: readIndex(item.benchmarks, 'coding_index'),
      agenticIndex: readIndex(item.benchmarks, 'agentic_index'),
    });
  }

  models.sort((left, right) => left.name.localeCompare(right.name));
  return models;
}
