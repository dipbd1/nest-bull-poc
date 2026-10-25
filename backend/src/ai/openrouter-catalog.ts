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

/** Safety cap so one catalog listing cannot carry an unbounded blurb. */
const DESCRIPTION_CAP = 4000;

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function isOpenRouterModelId(value: string): boolean {
  return MODEL_ID.test(value);
}

/**
 * The models list cuts blurbs with "...". The model page's JSON-LD keeps the
 * rest. Prefer the longest description that is not one of those cuts.
 */
export function readModelPageDescription(html: string): string | null {
  const found: string[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      collectDescriptions(JSON.parse(match[1]), found);
    } catch {
      continue;
    }
  }
  const complete = found
    .map((text) => text.trim())
    .filter((text) => text !== '' && !text.endsWith('...') && !text.endsWith('…'));
  if (complete.length === 0) return null;
  const longest = complete.reduce((best, text) =>
    text.length > best.length ? text : best,
  );
  return longest.length <= DESCRIPTION_CAP
    ? longest
    : longest.slice(0, DESCRIPTION_CAP);
}

function collectDescriptions(value: unknown, found: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectDescriptions(item, found);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.description === 'string') found.push(value.description);
  for (const child of Object.values(value)) collectDescriptions(child, found);
}

function readDescription(value: unknown): string {
  if (typeof value !== 'string') return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= DESCRIPTION_CAP
    ? compact
    : compact.slice(0, DESCRIPTION_CAP);
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
      description: readDescription(item.description),
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
