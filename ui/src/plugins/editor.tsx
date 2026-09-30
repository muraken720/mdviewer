// Markdown editor pane (one per tab): a <textarea> with list continuation, indentation and save.
// The status bar shows the cursor position (line, column) while editing. Switching between view and
// edit keeps roughly the same place in the document (see lib/scroll-sync.ts).
import {
  type KeyboardEvent,
  type ReactElement,
  type SyntheticEvent,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { App } from '../core/app';
import type { Tab } from '../core/tab';
import type { PaneProps, Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { type Edit, type EditOperation, enter, indent, outdent, toggleWrap } from '../lib/markdown-edit';
import { headingLines, interpolate } from '../lib/scroll-sync';

const KEYS: Record<string, EditOperation> = {
  Enter: enter,
  Tab: indent,
  'Shift+Tab': outdent,
  'Ctrl+b': (s) => toggleWrap(s, '**'),
  'Ctrl+i': (s) => toggleWrap(s, '*'),
};

/** Apply an Edit through the browser's editing commands so that Undo (Ctrl+Z) keeps working. */
function applyEdit(ta: HTMLTextAreaElement, edit: Edit) {
  ta.setSelectionRange(edit.from, edit.to);
  const ok =
    edit.insert === ''
      ? edit.from === edit.to || document.execCommand('delete')
      : document.execCommand('insertText', false, edit.insert);
  if (!ok) {
    ta.setRangeText(edit.insert, edit.from, edit.to, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  ta.setSelectionRange(...edit.select);
}

function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME conversion in progress
  const name = (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + e.key;
  const op = KEYS[name];
  if (!op) return;
  const ta = e.currentTarget;
  const edit = op({ text: ta.value, start: ta.selectionStart, end: ta.selectionEnd });
  e.preventDefault();
  if (edit) applyEdit(ta, edit);
}

/** 1-based line and column of offset `pos` in `text` (the column counts characters). */
export function cursorPosition(text: string, pos: number): { line: number; col: number } {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < pos; i = text.indexOf('\n', i + 1)) line++;
  return { line, col: pos - (text.lastIndexOf('\n', pos - 1) + 1) + 1 };
}

// The cursor position lives outside the app state: it changes on every key press, and only the
// status bar item needs it (going through app.emit would re-render the whole window).
let cursor = { line: 1, col: 1 };
const cursorListeners = new Set<() => void>();
function trackCursor(e: SyntheticEvent<HTMLTextAreaElement>) {
  updateCursor(e.currentTarget);
}
function updateCursor(ta: HTMLTextAreaElement) {
  const next = cursorPosition(ta.value, ta.selectionEnd);
  if (next.line === cursor.line && next.col === cursor.col) return;
  cursor = next;
  for (const fn of cursorListeners) fn();
}
function subscribeCursor(fn: () => void) {
  cursorListeners.add(fn);
  return () => cursorListeners.delete(fn);
}

function Editor({ app, tab, active }: PaneProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // The textarea is uncontrolled (keeps the browser's undo history); sync it when this tab loads.
  useEffect(() => {
    if (ref.current && tab.doc) ref.current.value = tab.doc.raw;
    return app.on('doc:loaded', (doc, { reset, tab: loaded }) => {
      const ta = ref.current;
      if (loaded !== tab || !ta || ta.value === doc.raw) return;
      const { selectionStart, selectionEnd, scrollTop } = ta;
      ta.value = doc.raw;
      if (reset) return ta.setSelectionRange(0, 0);
      ta.setSelectionRange(selectionStart, selectionEnd);
      ta.scrollTop = scrollTop;
    });
  }, [app, tab]);

  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);

  return (
    <textarea
      ref={ref}
      hidden={!active}
      data-editor={tab.id}
      spellCheck={false}
      aria-label={tab.doc?.name}
      onKeyDown={onKeyDown}
      onInput={(e) => {
        app.update(e.currentTarget.value, tab);
        trackCursor(e);
      }}
      onSelect={trackCursor}
      onKeyUp={trackCursor}
      onClick={trackCursor}
      onFocus={trackCursor}
      className="editor-paper block h-full w-full resize-none px-4 pb-16 font-mono text-fg outline-none [tab-size:4] sm:px-[max(2rem,calc((100%-820px*var(--zoom,1))/2))]"
    />
  );
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const BookIcon = () => (
  <svg {...ICON} aria-hidden="true">
    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z" />
    <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" />
  </svg>
);

const PencilIcon = () => (
  <svg {...ICON} aria-hidden="true">
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

/** "Ln 5, Col 12" in the status bar while editing. */
function CursorStatus({ app }: { app: App }) {
  useAppVersion(app);
  const { line, col } = useSyncExternalStore(subscribeCursor, () => cursor);
  if (!app.doc || app.mode !== 'edit') return null;
  return <span className="tabular-nums">{app.t('status.cursor', { line, col })}</span>;
}

/**
 * View | Edit switch at the right end of the status bar. The current mode is shaded gray (pressed),
 * so it reads as a state; blue is kept for links.
 */
function ModeToggle({ app }: { app: App }) {
  useAppVersion(app);
  if (!app.doc) return null;
  const segment = (mode: 'view' | 'edit', Icon: () => ReactElement) => {
    const active = app.mode === mode;
    const label = app.t(mode === 'view' ? 'mode.view' : 'mode.edit');
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        onClick={() => void app.setMode(mode)}
        className={`flex items-center gap-1.5 rounded px-2 font-medium text-fg leading-5 focus-visible:outline-2 focus-visible:outline-link ${
          active ? 'bg-line text-fg' : 'cursor-pointer text-fg hover:bg-code'
        }`}
      >
        <Icon />
        {label}
      </button>
    );
  };
  return (
    <fieldset
      aria-label={app.t('cmd.view.toggleEdit')}
      title={`${app.t('cmd.view.toggleEdit')} (Ctrl+E)`}
      className="flex shrink-0 gap-0.5 rounded-md border border-line bg-bg p-px"
    >
      {segment('view', BookIcon)}
      {segment('edit', PencilIcon)}
    </fieldset>
  );
}

// ---- keeping the place between view and edit ----

const viewerOf = (tab: Tab) => document.querySelector<HTMLElement>(`[data-viewer="${tab.id}"]`);
const editorOf = (tab: Tab) => document.querySelector<HTMLTextAreaElement>(`[data-editor="${tab.id}"]`);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Pixel positions in the viewer paired with Markdown line numbers: top, each heading, bottom. */
function viewAnchors(scroller: HTMLElement, text: string): { px: number[]; lines: number[] } {
  const px = [0];
  const lines = [0];
  const els = scroller.querySelectorAll('article h1, article h2, article h3, article h4, article h5, article h6');
  const src = headingLines(text);
  if (els.length === src.length) {
    const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
    els.forEach((el, i) => {
      px.push(el.getBoundingClientRect().top - top);
      lines.push(src[i] as number);
    });
  }
  px.push(scroller.scrollHeight);
  lines.push(text.split('\n').length);
  return { px, lines };
}

/** Top of each line of the textarea's text in its scroll area (wrapped lines are taller), plus the end. */
function lineTops(ta: HTMLTextAreaElement): number[] {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement('div');
  for (const p of [
    'font',
    'letterSpacing',
    'wordSpacing',
    'lineHeight',
    'tabSize',
    'overflowWrap',
    'wordBreak',
  ] as const)
    mirror.style[p] = cs[p];
  mirror.style.cssText += `;position:absolute;visibility:hidden;left:-99999px;top:0;box-sizing:border-box;white-space:pre-wrap;width:${ta.clientWidth}px;padding:${cs.padding}`;
  for (const line of ta.value.split('\n')) {
    const row = document.createElement('div');
    row.textContent = line || '\u200b';
    mirror.append(row);
  }
  document.body.append(mirror);
  const tops = [...mirror.children].map((row) => (row as HTMLElement).offsetTop);
  tops.push(mirror.scrollHeight - Number.parseFloat(cs.paddingBottom));
  mirror.remove();
  return tops;
}

/** The (fractional) Markdown line at the top of the tab's visible pane, if it is shown. */
function topLine(tab: Tab): number | undefined {
  const text = tab.doc?.raw;
  if (text === undefined) return;
  if (tab.mode === 'view') {
    const scroller = viewerOf(tab);
    if (!scroller || scroller.hidden) return;
    const { px, lines } = viewAnchors(scroller, text);
    return interpolate(scroller.scrollTop, px, lines);
  }
  const ta = editorOf(tab);
  if (!ta || ta.hidden) return;
  const tops = lineTops(ta);
  return interpolate(ta.scrollTop + Number.parseFloat(getComputedStyle(ta).paddingTop), tops, range(tops.length));
}

/** Scroll the tab's visible pane so that Markdown line `line` is at the top. */
function scrollToLine(tab: Tab, line: number) {
  const text = tab.doc?.raw;
  if (text === undefined) return;
  if (tab.mode === 'view') {
    const scroller = viewerOf(tab);
    if (!scroller || scroller.hidden) return;
    const { px, lines } = viewAnchors(scroller, text);
    scroller.scrollTop = tab.scroll = interpolate(line, lines, px);
    return;
  }
  const ta = editorOf(tab);
  if (!ta || ta.hidden) return;
  // Put the cursor at the start of the first line shown, where an edit most likely begins.
  const first = Math.min(Math.ceil(line - 0.01), text.split('\n').length - 1);
  let offset = 0;
  for (let i = 0; i < first; i++) offset = text.indexOf('\n', offset) + 1;
  ta.setSelectionRange(offset, offset);
  updateCursor(ta);
  const tops = lineTops(ta);
  ta.scrollTop = interpolate(line, range(tops.length), tops) - Number.parseFloat(getComputedStyle(ta).paddingTop);
}

/** Run `fn` once the switched-to pane has been laid out. */
function afterLayout(fn: () => void) {
  const raf = window.requestAnimationFrame?.bind(window) ?? ((f: () => void) => setTimeout(f, 16));
  raf(() => raf(fn));
}

const editor: Plugin = {
  name: 'editor',
  setup(app) {
    app.addPane('edit', Editor);
    app.addStatusItem(CursorStatus, 10);
    app.addStatusItem(ModeToggle, 100);

    const place = new WeakMap<Tab, number>();
    app.on('mode:changing', (_mode, tab) => {
      const line = topLine(tab);
      if (line !== undefined) place.set(tab, line);
    });
    app.on('mode:changed', (_mode, tab) => {
      const line = place.get(tab);
      place.delete(tab);
      if (line !== undefined) afterLayout(() => scrollToLine(tab, line));
    });

    const hasDoc = () => !!app.doc;
    app.command({
      id: 'view.toggleEdit',
      title: 'cmd.view.toggleEdit',
      keys: ['Ctrl+E'],
      run: () => app.setMode(app.mode === 'edit' ? 'view' : 'edit'),
      enabled: hasDoc,
      checked: () => app.mode === 'edit',
    });
    app.command({ id: 'file.save', title: 'cmd.file.save', keys: ['Ctrl+S'], run: () => app.save(), enabled: hasDoc });
    app.addMenuItem({ menu: 'edit', command: 'view.toggleEdit', group: 10 });
    app.addMenuItem({ menu: 'file', command: 'file.save', group: 20 });
  },
};
export default editor;
