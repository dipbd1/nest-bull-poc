export const MIN_TAGS = 2;
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 40;
export const MIN_COMMENTS = 1;
export const MAX_COMMENTS = 100;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 200;

export class BatchInputError extends Error {}

export function parseTags(raw: string[]): string[] {
  const tags = raw.map((tag) => tag.trim());
  if (tags.some((tag) => tag === '')) {
    throw new BatchInputError('Tags cannot be blank');
  }
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new BatchInputError(
      `Each tag can be at most ${MAX_TAG_LENGTH} characters`,
    );
  }
  const seen = new Set(tags.map((tag) => tag.toLowerCase()));
  if (seen.size !== tags.length) {
    throw new BatchInputError('Tags must be unique');
  }
  if (tags.length < MIN_TAGS || tags.length > MAX_TAGS) {
    throw new BatchInputError(
      `Use between ${MIN_TAGS} and ${MAX_TAGS} tags`,
    );
  }
  return tags;
}

/** One comment per line. Blank lines are dropped. */
export function parseComments(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length < MIN_COMMENTS) {
    throw new BatchInputError('Paste at least one comment');
  }
  if (lines.length > MAX_COMMENTS) {
    throw new BatchInputError(
      `A batch can hold at most ${MAX_COMMENTS} comments`,
    );
  }
  const tooLong = lines.findIndex((line) => line.length > MAX_COMMENT_LENGTH);
  if (tooLong !== -1) {
    throw new BatchInputError(
      `Comment ${tooLong + 1} is longer than ${MAX_COMMENT_LENGTH} characters`,
    );
  }
  return lines;
}
