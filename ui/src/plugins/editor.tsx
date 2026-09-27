// Markdown editor pane (one per tab): a <textarea> with list continuation, indentation and save.
import { type KeyboardEvent, useEffect, useRef } from 'react';
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
      className="block h-full w-full resize-none bg-bg px-4 pt-6 pb-16 font-mono text-[calc(16px*var(--zoom,1))] text-fg leading-relaxed outline-none [tab-size:4] sm:px-[max(2rem,calc((100%-820px)/2))] sm:pt-8"
    />
  );
}

function ModeToggle({ app }: { app: App }) {
  useAppVersion(app);
  if (!app.doc) return null;
  const editing = app.mode === 'edit';
  return (
    <button
      type="button"
      title={`${app.t('cmd.view.toggleEdit')} (Ctrl+E)`}
      onClick={() => app.run('view.toggleEdit')}
      className="absolute top-2 right-5 z-10 cursor-pointer rounded-md border border-line bg-bg px-2.5 py-1 text-muted text-xs opacity-70 hover:opacity-100 print:hidden"
    >
      {app.t(editing ? 'mode.view' : 'mode.edit')}
    </button>
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
