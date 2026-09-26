import { expect, test } from 'vitest';
import {
  applyEdit,
  type Edit,
  type EditorState,
  enter,
  inCodeFence,
  indent,
  outdent,
  parseListItem,
  toggleWrap,
} from './markdown-edit';

// Write states with "|" for the cursor, or "[" "]" for a selection.
function state(src: string): EditorState {
  if (src.includes('|')) {
    const start = src.indexOf('|');
    return { text: src.replace('|', ''), start, end: start };
  }
  const start = src.indexOf('[');
  const end = src.indexOf(']') - 1;
  return { text: src.replace('[', '').replace(']', ''), start, end };
}
function show(text: string, [s, e]: [number, number]) {
  return s === e ? `${text.slice(0, s)}|${text.slice(s)}` : `${text.slice(0, s)}[${text.slice(s, e)}]${text.slice(e)}`;
}
function run(op: (s: EditorState) => Edit | null, src: string) {
  const s = state(src);
  const edit = op(s);
  return edit && show(applyEdit(s.text, edit), edit.select);
}

test('enter keeps indentation', () => {
  expect(run(enter, '    code|')).toBe('    code\n    |');
  expect(run(enter, 'plain|')).toBe('plain\n|');
});

test('enter continues bullet, ordered and task lists', () => {
  expect(run(enter, '- a|')).toBe('- a\n- |');
  expect(run(enter, '  * a|')).toBe('  * a\n  * |');
  expect(run(enter, '9. a|')).toBe('9. a\n10. |');
  expect(run(enter, '1) a|')).toBe('1) a\n2) |');
  expect(run(enter, '- [x] done|')).toBe('- [x] done\n- [ ] |');
});

test('enter in the middle of an item splits it', () => {
  expect(run(enter, '- ab|cd')).toBe('- ab\n- |cd');
});

test('enter on an empty item ends or outdents the list', () => {
  expect(run(enter, '- a\n- |')).toBe('- a\n|');
  expect(run(enter, '- a\n  - |')).toBe('- a\n- |');
  expect(run(enter, '- [ ] |')).toBe('|');
});

test('enter continues and ends block quotes', () => {
  expect(run(enter, '> quote|')).toBe('> quote\n> |');
  expect(run(enter, '> a\n> |')).toBe('> a\n|');
});

test('enter inside a code fence only keeps indentation', () => {
  expect(run(enter, '```\n- not a list|')).toBe('```\n- not a list\n|');
  expect(run(enter, '```\n```\n- a|')).toBe('```\n```\n- a\n- |');
  expect(inCodeFence('```js\nx', 7)).toBe(true);
});

test('enter replaces the selection', () => {
  expect(run(enter, '- a[bc]d')).toBe('- a\n- |d');
});

test('tab indents list items and selected lines, inserts spaces otherwise', () => {
  expect(run(indent, '- a|')).toBe('  - a|');
  expect(run(indent, 'x|y')).toBe('x  |y');
  expect(run(indent, '[a\nb]')).toBe('  [a\n  b]');
  expect(run(indent, 'a\n[b\n]c')).toBe('a\n  [b\n]c');
});

test('shift+tab outdents', () => {
  expect(run(outdent, '    - a|')).toBe('  - a|');
  expect(run(outdent, '[  a\n b]')).toBe('[a\nb]');
  expect(run(outdent, 'a|')).toBeNull();
});

test('toggleWrap wraps and unwraps', () => {
  expect(run((s) => toggleWrap(s, '**'), 'x [bold] y')).toBe('x **[bold]** y');
  expect(run((s) => toggleWrap(s, '**'), 'x **[bold]** y')).toBe('x [bold] y');
  expect(run((s) => toggleWrap(s, '*'), 'x | y')).toBe('x *|* y');
});

test('parseListItem', () => {
  expect(parseListItem('  12. [ ] x')).toEqual({
    prefix: '  12. [ ] ',
    indent: '  ',
    marker: '12.',
    num: 12,
    delim: '.',
    space: ' ',
    task: '[ ] ',
  });
  expect(parseListItem('-no space')).toBeNull();
  expect(parseListItem('text')).toBeNull();
});
