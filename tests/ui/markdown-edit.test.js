import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enter, indent, outdent, toggleWrap, inCodeFence, parseListItem, applyEdit } from '../../ui/lib/markdown-edit.js';

// Write states with "|" for the cursor, or "[" "]" for a selection.
function state(src) {
  if (src.includes('|')) {
    const start = src.indexOf('|');
    return { text: src.replace('|', ''), start, end: start };
  }
  const start = src.indexOf('[');
  const end = src.indexOf(']') - 1;
  return { text: src.replace('[', '').replace(']', ''), start, end };
}
function show(text, [s, e]) {
  return s === e ? text.slice(0, s) + '|' + text.slice(s) : text.slice(0, s) + '[' + text.slice(s, e) + ']' + text.slice(e);
}
function run(op, src, ...args) {
  const s = state(src);
  const edit = op(s, ...args);
  if (!edit) return null;
  return show(applyEdit(s.text, edit), edit.select);
}

test('enter keeps indentation', () => {
  assert.equal(run(enter, '    code|'), '    code\n    |');
  assert.equal(run(enter, 'plain|'), 'plain\n|');
});

test('enter continues bullet, ordered and task lists', () => {
  assert.equal(run(enter, '- a|'), '- a\n- |');
  assert.equal(run(enter, '  * a|'), '  * a\n  * |');
  assert.equal(run(enter, '9. a|'), '9. a\n10. |');
  assert.equal(run(enter, '1) a|'), '1) a\n2) |');
  assert.equal(run(enter, '- [x] done|'), '- [x] done\n- [ ] |');
});

test('enter in the middle of an item splits it', () => {
  assert.equal(run(enter, '- ab|cd'), '- ab\n- |cd');
});

test('enter on an empty item ends or outdents the list', () => {
  assert.equal(run(enter, '- a\n- |'), '- a\n|');
  assert.equal(run(enter, '- a\n  - |'), '- a\n- |');
  assert.equal(run(enter, '- [ ] |'), '|');
});

test('enter continues and ends block quotes', () => {
  assert.equal(run(enter, '> quote|'), '> quote\n> |');
  assert.equal(run(enter, '> a\n> |'), '> a\n|');
});

test('enter inside a code fence only keeps indentation', () => {
  assert.equal(run(enter, '```\n- not a list|'), '```\n- not a list\n|');
  assert.equal(run(enter, '```\n```\n- a|'), '```\n```\n- a\n- |');
  assert.equal(inCodeFence('```js\nx', 7), true);
});

test('enter replaces the selection', () => {
  assert.equal(run(enter, '- a[bc]d'), '- a\n- |d');
});

test('tab indents list items and selected lines, inserts spaces otherwise', () => {
  assert.equal(run(indent, '- a|'), '  - a|');
  assert.equal(run(indent, 'x|y'), 'x  |y');
  assert.equal(run(indent, '[a\nb]'), '  [a\n  b]');
  assert.equal(run(indent, 'a\n[b\n]c'), 'a\n  [b\n]c', 'line after a trailing newline is untouched');
});

test('shift+tab outdents', () => {
  assert.equal(run(outdent, '    - a|'), '  - a|');
  assert.equal(run(outdent, '[  a\n b]'), '[a\nb]');
  assert.equal(run(outdent, 'a|'), null);
});

test('toggleWrap wraps and unwraps', () => {
  assert.equal(run(toggleWrap, 'x [bold] y', '**'), 'x **[bold]** y');
  assert.equal(run(toggleWrap, 'x **[bold]** y', '**'), 'x [bold] y');
  assert.equal(run(toggleWrap, 'x | y', '*'), 'x *|* y');
});

test('parseListItem', () => {
  assert.deepEqual(parseListItem('  12. [ ] x'), { prefix: '  12. [ ] ', indent: '  ', marker: '12.', num: 12, delim: '.', space: ' ', task: '[ ] ' });
  assert.equal(parseListItem('-no space'), null);
  assert.equal(parseListItem('text'), null);
});
