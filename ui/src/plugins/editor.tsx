// Markdown editor pane (one per tab): a <textarea> with list continuation, indentation and save.
// The status bar shows the cursor position (line, column) while editing.
import {
  type KeyboardEvent,
  type ReactElement,
  type SyntheticEvent,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { App } from '../core/app';
import type { PaneProps, Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { type Edit, type EditOperation, enter, indent, outdent, toggleWrap } from '../lib/markdown-edit';

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
  const ta = e.currentTarget;
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
      className="editor-paper block h-full w-full resize-none px-4 pb-16 font-mono text-fg outline-none [tab-size:4] sm:px-[max(2rem,calc((100%-820px)/2))]"
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

const editor: Plugin = {
  name: 'editor',
  setup(app) {
    app.addPane('edit', Editor);
    app.addStatusItem(CursorStatus, 10);
    app.addStatusItem(ModeToggle, 100);
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
