// Markdown editing operations for a plain <textarea>.
//
// Every function takes the editor state { text, start, end } (selection offsets) and returns
// an Edit { from, to, insert, select: [start, end] } — "replace text[from, to) with insert,
// then select" — or null when the default browser behaviour is fine.
// Pure functions: no DOM, so they are unit-tested in tests/ui/markdown-edit.test.js.

/** @typedef {{ text: string, start: number, end: number }} State */
/** @typedef {{ from: number, to: number, insert: string, select: [number, number] }} Edit */

export const INDENT = '  ';

// indent, marker ("-", "*", "+", "1." or "1)"), spacing, optional task box
const LIST = /^(\s*)([-*+]|(\d{1,9})([.)]))(\s+)(\[[ xX]\]\s+)?/;
const QUOTE = /^(\s*(?:>\s?)+)/;
const FENCE = /^\s{0,3}(```|~~~)/;

const lineStart = (text, pos) => text.lastIndexOf('\n', pos - 1) + 1;
const lineEnd = (text, pos) => {
  const i = text.indexOf('\n', pos);
  return i === -1 ? text.length : i;
};
const leadingSpace = (line) => line.match(/^\s*/)[0];

/** True if `pos` is inside a fenced code block. */
export function inCodeFence(text, pos) {
  let open = false;
  for (const line of text.slice(0, lineStart(text, pos)).split('\n')) {
    if (FENCE.test(line)) open = !open;
  }
  return open;
}

/** Parse a list item at the start of `line`. */
export function parseListItem(line) {
  const m = line.match(LIST);
  if (!m) return null;
  const [prefix, indent, marker, num, delim, space, task] = m;
  return { prefix, indent, marker, num: num ? Number(num) : null, delim, space, task: task ?? '' };
}

function nextMarker(item) {
  const marker = item.num === null ? item.marker : `${item.num + 1}${item.delim}`;
  return item.indent + marker + item.space + (item.task ? '[ ] ' : '');
}

/**
 * Enter: keep indentation, continue lists / task lists / block quotes,
 * and end the list when Enter is pressed on an empty item.
 * @param {State} s
 * @returns {Edit}
 */
export function enter({ text, start, end }) {
  const ls = lineStart(text, start);
  const le = lineEnd(text, end);
  const before = text.slice(ls, start);
  const restOfLine = text.slice(end, le);
  const newline = (prefix) => {
    const insert = '\n' + prefix;
    return { from: start, to: end, insert, select: [start + insert.length, start + insert.length] };
  };

  if (inCodeFence(text, start)) return newline(leadingSpace(before));

  const item = parseListItem(before);
  if (item) {
    const empty = before.length === item.prefix.length && restOfLine.trim() === '';
    if (!empty) return newline(nextMarker(item));
    // Empty item: outdent one level if nested, otherwise end the list.
    const indent = item.indent.slice(INDENT.length);
    const replacement = item.indent.length > 0 ? indent + item.prefix.slice(item.indent.length) : '';
    return { from: ls, to: end, insert: replacement, select: [ls + replacement.length, ls + replacement.length] };
  }

  const quote = before.match(QUOTE);
  if (quote) {
    if (before.trim() === quote[1].trim() && restOfLine.trim() === '') {
      return { from: ls, to: end, insert: '', select: [ls, ls] }; // empty quote line ends the quote
    }
    return newline(quote[1]);
  }

  return newline(leadingSpace(before));
}

/**
 * Tab: indent the selected lines (or the current list item); otherwise insert spaces.
 * @param {State} s
 * @returns {Edit}
 */
export function indent({ text, start, end }) {
  const ls = lineStart(text, start);
  const multiline = text.slice(start, end).includes('\n');
  if (!multiline && !parseListItem(text.slice(ls, lineEnd(text, start)))) {
    return { from: start, to: end, insert: INDENT, select: [start + INDENT.length, start + INDENT.length] };
  }
  return mapLines({ text, start, end }, (line) => INDENT + line);
}

/**
 * Shift+Tab: outdent the selected lines (or the current line).
 * @param {State} s
 * @returns {Edit|null}
 */
export function outdent(s) {
  const edit = mapLines(s, (line) => line.replace(new RegExp(`^( {1,${INDENT.length}}|\\t)`), ''));
  return edit.insert === s.text.slice(edit.from, edit.to) ? null : edit;
}

/**
 * Ctrl+B / Ctrl+I: wrap the selection in `mark` (e.g. "**"), or unwrap if already wrapped.
 * @param {State} s
 * @param {string} mark
 * @returns {Edit}
 */
export function toggleWrap({ text, start, end }, mark) {
  const n = mark.length;
  if (text.slice(start - n, start) === mark && text.slice(end, end + n) === mark) {
    return { from: start - n, to: end + n, insert: text.slice(start, end), select: [start - n, end - n] };
  }
  const sel = text.slice(start, end);
  return { from: start, to: end, insert: mark + sel + mark, select: [start + n, end + n] };
}

/** Apply `fn` to every line touched by the selection, keeping the selection on the same text. */
function mapLines({ text, start, end }, fn) {
  const from = lineStart(text, start);
  // A selection ending at the very start of a line does not include that line.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const to = lineEnd(text, last);
  const lines = text.slice(from, to).split('\n');
  const mapped = lines.map(fn);
  const insert = mapped.join('\n');

  const firstDelta = mapped[0].length - lines[0].length;
  const newStart = Math.max(from, start + firstDelta);
  const newEnd = Math.max(newStart, end + (insert.length - (to - from)));
  return { from, to, insert, select: start === end ? [newStart, newStart] : [newStart, newEnd] };
}

/** Apply an Edit to a string (used by tests and as a fallback). */
export function applyEdit(text, edit) {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}
