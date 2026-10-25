import {
  BatchInputError,
  MAX_COMMENT_LENGTH,
  MAX_COMMENTS,
  parseComments,
  parseTags,
} from './batch.limits.js';
import { csvCell, itemsToCsv } from './batch.csv.js';
import type { FeedbackItem } from './entities/feedback-item.entity.js';

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `comment ${index + 1}`).join(
    '\n',
  );
}

describe('parseComments', () => {
  it('drops blank lines and trims each comment', () => {
    expect(parseComments('  first \r\n\n\t\nsecond\n')).toEqual([
      'first',
      'second',
    ]);
  });

  it('accepts exactly the line cap', () => {
    expect(parseComments(lines(MAX_COMMENTS))).toHaveLength(MAX_COMMENTS);
  });

  it('rejects one line over the cap', () => {
    expect(() => parseComments(lines(MAX_COMMENTS + 1))).toThrow(
      BatchInputError,
    );
  });

  it('rejects an empty paste', () => {
    expect(() => parseComments('\n \n')).toThrow('Paste at least one comment');
  });

  it('rejects a comment over the character limit', () => {
    const long = 'x'.repeat(MAX_COMMENT_LENGTH + 1);
    expect(() => parseComments(`ok\n${long}`)).toThrow('Comment 2');
    expect(parseComments('x'.repeat(MAX_COMMENT_LENGTH))).toHaveLength(1);
  });
});

describe('parseTags', () => {
  it('accepts two to eight unique tags', () => {
    expect(parseTags([' Bug ', 'Praise'])).toEqual(['Bug', 'Praise']);
    expect(parseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toHaveLength(8);
  });

  it('rejects too few, too many, duplicate, blank, and long tags', () => {
    expect(() => parseTags(['only'])).toThrow(BatchInputError);
    expect(() =>
      parseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']),
    ).toThrow(BatchInputError);
    expect(() => parseTags(['Bug', 'bug'])).toThrow('Tags must be unique');
    expect(() => parseTags(['Bug', ' '])).toThrow('Tags cannot be blank');
    expect(() => parseTags(['Bug', 'x'.repeat(41)])).toThrow(BatchInputError);
  });
});

describe('CSV export', () => {
  it('quotes separators and defuses formulas', () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });

  it('writes the header and rows in position order', () => {
    const items = [
      { position: 2, text: 'two', suggestedTag: 'Bug', summary: 's2', finalTag: null, status: 'coded' },
      { position: 1, text: 'one', suggestedTag: null, summary: null, finalTag: 'Praise', status: 'needs_review' },
    ] as FeedbackItem[];

    expect(itemsToCsv(items)).toBe(
      'position,text,suggested_tag,summary,final_tag,status\r\n' +
        '1,one,,,Praise,needs_review\r\n' +
        '2,two,Bug,s2,,coded\r\n',
    );
  });
});
