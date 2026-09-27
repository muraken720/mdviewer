// Markdown editor pane (one per tab): a <textarea> with list continuation, indentation and save.
import { type KeyboardEvent, type ReactElement, useEffect, useRef } from 'react';
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
      onInput={(e) => app.update(e.currentTarget.value, tab)}
      className="block h-full w-full resize-none bg-bg px-4 pt-14 pb-16 font-mono text-[calc(16px*var(--zoom,1))] text-fg leading-relaxed outline-none [tab-size:4] sm:px-[max(2rem,calc((100%-820px)/2))]"
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

const EyeIcon = () => (
  <svg {...ICON} aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PencilIcon = () => (
  <svg {...ICON} aria-hidden="true">
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

/** View | Edit switch at the top right. The current mode is filled, so it reads as a state. */
function ModeToggle({ app }: { app: App }) {
  useAppVersion(app);
  if (!app.doc) return null;
  const segment = (mode: 'view' | 'edit', Icon: () => ReactElement) => {
    const active = app.mode === mode;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => void app.setMode(mode)}
        className={`flex items-center gap-1.5 rounded px-3 py-1 font-medium text-sm focus-visible:outline-2 focus-visible:outline-link ${
          active ? 'bg-link text-bg' : 'cursor-pointer text-fg hover:bg-code'
        }`}
      >
        <Icon />
        {app.t(mode === 'view' ? 'mode.view' : 'mode.edit')}
      </button>
    );
  };
  return (
    <fieldset
      aria-label={app.t('cmd.view.toggleEdit')}
      title={`${app.t('cmd.view.toggleEdit')} (Ctrl+E)`}
      className="absolute top-2 right-5 z-10 flex gap-0.5 rounded-md border border-line bg-bg p-0.5 shadow-md print:hidden"
    >
      {segment('view', EyeIcon)}
      {segment('edit', PencilIcon)}
    </fieldset>
  );
}

const editor: Plugin = {
  name: 'editor',
  setup(app) {
    app.addPane('edit', Editor);
    app.addOverlay(ModeToggle);
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
