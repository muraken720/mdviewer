import { expect, test } from 'vitest';
import { findAll, textRanges } from './find';

test('findAll is case-insensitive by default and non-overlapping', () => {
  expect(findAll('Foo foo FOO', 'foo')).toHaveLength(3);
  expect(findAll('Foo foo FOO', 'foo', true)).toEqual([{ start: 4, end: 7 }]);
  expect(findAll('aaaa', 'aa')).toEqual([
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]);
  expect(findAll('abc', '')).toEqual([]);
  expect(findAll('日本語の文書', '文書')).toEqual([{ start: 4, end: 6 }]);
});

test('textRanges finds matches across element boundaries', () => {
  const root = document.createElement('div');
  root.innerHTML = '<p>hello <strong>wor</strong>ld</p><p>world</p>';
  const ranges = textRanges(root, 'world');
  expect(ranges.map((r) => r.toString())).toEqual(['world', 'world']);
  expect(ranges[0]?.startContainer.nodeValue).toBe('wor');
  expect(ranges[0]?.endContainer.nodeValue).toBe('ld');
});
