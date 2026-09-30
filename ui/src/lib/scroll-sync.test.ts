import { expect, test } from 'vitest';
import { headingLines, interpolate } from './scroll-sync';

test('headingLines finds ATX headings, also in quotes, but not in fenced code', () => {
  const text = [
    '# Title',
    'text',
    '```',
    '# not a heading',
    '```',
    '## Two',
    '> ### Quoted',
    '#no space',
    '~~~~',
    '# no',
    '~~~~',
    '###',
  ].join('\n');
  expect(headingLines(text)).toEqual([0, 5, 6, 11]);
  // Inline code at the start of a line is not a fence.
  expect(headingLines(['```` ```mermaid ```` block', '# After'].join('\n'))).toEqual([1]);
  // A closing fence needs at least as many markers as the opening one.
  expect(headingLines(['````', '```', '# in code', '````', '# out'].join('\n'))).toEqual([4]);
});

test('interpolate maps through the points and clamps at the ends', () => {
  const xs = [0, 100, 300];
  const ys = [0, 10, 20];
  expect(interpolate(50, xs, ys)).toBe(5);
  expect(interpolate(200, xs, ys)).toBe(15);
  expect(interpolate(-5, xs, ys)).toBe(0);
  expect(interpolate(999, xs, ys)).toBe(20);
  expect(interpolate(0, [0, 0, 10], [0, 3, 6])).toBe(0);
  expect(interpolate(1, [], [])).toBe(0);
});
