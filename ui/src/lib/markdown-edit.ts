// Markdown editing operations for a plain <textarea>.
//
// Every operation takes the editor state (text + selection) and returns an Edit — "replace
// text[from, to) with insert, then select" — or null when the browser default is fine.
// Pure functions without DOM access; see markdown-edit.test.ts.

export interface EditorState {
  text: string;
  start: number;
  end: number;
}

export interface Edit {
  from: number;
  to: number;
  insert: string;
  select: [number, number];
}

export type EditOperation = (state: EditorState) => Edit | null;

export const INDENT = '  ';

// indent, marker ("-", "*", "+", "1." or "1)"), spacing, optional task box
const LIST = /^(\s*)([-*+]|(\d{1,9})([.)]))(\s+)(\[[ xX]\]\s+)?/;
const QUOTE = /^(\s*(?:>\s?)+)/;
const FENCE = /^\s{0,3}(```|~~~)/;

const lineStart = (text: string, pos: number) => text.lastIndexOf('\n', pos - 1) + 1;
const lineEnd = (text: string, pos: number) => {
  const i = text.indexOf('\n', pos);
  return i === -1 ? text.length : i;
};
const leadingSpace = (line: string) => /^\s*/.exec(line)?.[0] ?? '';
const caret = (from: number, insert: string): Edit['select'] => [from + insert.length, from + insert.length];

/** True if `pos` is inside a fenced code block. */
export function inCodeFence(text: string, pos: number): boolean {
  let open = false;
  for (const line of text.slice(0, lineStart(text, pos)).split('\n')) {
    if (FENCE.test(line)) open = !open;
  }
  return open;
}

export interface ListItem {
  prefix: string;
  indent: string;
  marker: string;
  num: number | null;
  delim: string;
  space: string;
  task: string;
}

/** Parse a list item at the start of `line`. */
export function parseListItem(line: string): ListItem | null {
  const m = LIST.exec(line);
  if (!m) return null;
  const [prefix, indent = '', marker = '', num, delim = '', space = '', task = ''] = m;
  return { prefix, indent, marker, num: num ? Number(num) : null, delim, space, task };
}

function nextMarker(item: ListItem): string {
  const marker = item.num === null ? item.marker : `${item.num + 1}${item.delim}`;
  return item.indent + marker + item.space + (item.task ? '[ ] ' : '');
}

/**
 * Enter: keep indentation, continue lists / task lists / block quotes,
 * and end the list when Enter is pressed on an empty item.
 */
export const enter: EditOperation = ({ text, start, end }) => {
  const ls = lineStart(text, start);
  const le = lineEnd(text, end);
  const before = text.slice(ls, start);
  const restOfLine = text.slice(end, le);
  const newline = (prefix: string): Edit => {
    const insert = '\n' + prefix;
    return { from: start, to: end, insert, select: caret(start, insert) };
  };

  if (inCodeFence(text, start)) return newline(leadingSpace(before));

  const item = parseListItem(before);
  if (item) {
    const empty = before.length === item.prefix.length && restOfLine.trim() === '';
    if (!empty) return newline(nextMarker(item));
    // Empty item: outdent one level if nested, otherwise end the list.
    const insert = item.indent.length > 0 ? item.indent.slice(INDENT.length) + item.prefix.slice(item.indent.length) : '';
    return { from: ls, to: end, insert, select: caret(ls, insert) };
  }

  const quote = QUOTE.exec(before);
  if (quote?.[1]) {
    if (before.trim() === quote[1].trim() && restOfLine.trim() === '') {
      return { from: ls, to: end, insert: '', select: [ls, ls] }; // empty quote line ends the quote
    }
    return newline(quote[1]);
  }

  return newline(leadingSpace(before));
};

/** Tab: indent the selected lines (or the current list item); otherwise insert spaces. */
export const indent: EditOperation = ({ text, start, end }) => {
  const multiline = text.slice(start, end).includes('\n');
  if (!multiline && !parseListItem(text.slice(lineStart(text, start), lineEnd(text, start)))) {
    return { from: start, to: end, insert: INDENT, select: caret(start, INDENT) };
  }
  return mapLines({ text, start, end }, (line) => INDENT + line);
};

/** Shift+Tab: outdent the selected lines (or the current line). */
export const outdent: EditOperation = (s) => {
  const edit = mapLines(s, (line) => line.replace(new RegExp(`^( {1,${INDENT.length}}|\\t)`), ''));
  return edit.insert === s.text.slice(edit.from, edit.to) ? null : edit;
};

/** Ctrl+B / Ctrl+I: wrap the selection in `mark` (e.g. "**"), or unwrap if already wrapped. */
export function toggleWrap({ text, start, end }: EditorState, mark: string): Edit {
  const n = mark.length;
  if (text.slice(start - n, start) === mark && text.slice(end, end + n) === mark) {
    return { from: start - n, to: end + n, insert: text.slice(start, end), select: [start - n, end - n] };
  }
  return { from: start, to: end, insert: mark + text.slice(start, end) + mark, select: [start + n, end + n] };
}

/** Apply `fn` to every line touched by the selection, keeping the selection on the same text. */
function mapLines({ text, start, end }: EditorState, fn: (line: string) => string): Edit {
  const from = lineStart(text, start);
  // A selection ending at the very start of a line does not include that line.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const to = lineEnd(text, last);
  const lines = text.slice(from, to).split('\n');
  const mapped = lines.map(fn);
  const insert = mapped.join('\n');

  const firstDelta = (mapped[0] ?? '').length - (lines[0] ?? '').length;
  const newStart = Math.max(from, start + firstDelta);
  const newEnd = Math.max(newStart, end + (insert.length - (to - from)));
  return { from, to, insert, select: start === end ? [newStart, newStart] : [newStart, newEnd] };
}

/** Apply an Edit to a string (used by tests and as a fallback). */
export function applyEdit(text: string, edit: Edit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}
