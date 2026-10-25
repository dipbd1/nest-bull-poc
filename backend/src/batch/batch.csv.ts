import type { FeedbackItem } from './entities/feedback-item.entity.js';

export const CSV_HEADER = [
  'position',
  'text',
  'suggested_tag',
  'summary',
  'final_tag',
  'status',
];

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Quotes a cell and defuses spreadsheet formulas in user text. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function itemsToCsv(items: FeedbackItem[]): string {
  const rows = [...items]
    .sort((left, right) => left.position - right.position)
    .map((item) =>
      [
        item.position,
        item.text,
        item.suggestedTag,
        item.summary,
        item.finalTag,
        item.status,
      ]
        .map(csvCell)
        .join(','),
    );
  return [CSV_HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

export function csvFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'batch'}.csv`;
}
