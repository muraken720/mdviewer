// Markdown editor pane: a <textarea> with list continuation, indentation and save.
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

function Editor({ app, active }: PaneProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // The textarea is uncontrolled (keeps the browser's undo history); sync it on load.
  useEffect(() => {
    if (ref.current && app.doc) ref.current.value = app.doc.raw;
    return app.on('doc:loaded', (doc, { reset }) => {
      const ta = ref.current;
      if (!ta || ta.value === doc.raw) return;
      const { selectionStart, selectionEnd, scrollTop } = ta;
      ta.value = doc.raw;
      if (reset) return ta.setSelectionRange(0, 0);
      ta.setSelectionRange(selectionStart, selectionEnd);
      ta.scrollTop = scrollTop;
    });
  }, [app]);

  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);

  return (
    <textarea
      ref={ref}
      hidden={!active}
      spellCheck={false}
      onKeyDown={onKeyDown}
      onInput={(e) => app.update(e.currentTarget.value)}
      className="block h-screen w-full resize-none bg-bg px-[max(40px,calc((100%-820px)/2))] pt-8 pb-20 font-mono text-[calc(14px*var(--zoom,1))] leading-relaxed text-fg outline-none [tab-size:4]"
    />
  );
}

function ModeToggle({ app }: { app: App }) {
  useAppVersion(app);
  if (!app.doc) return null;
  return (
    <button
      type="button"
      title="表示 / 編集の切替 (Ctrl+E)"
      onClick={() => app.run('view.toggleEdit')}
      className="fixed top-2.5 right-4 z-10 cursor-pointer rounded-md border border-line bg-bg px-2.5 py-1.5 text-xs text-muted opacity-60 hover:opacity-100"
    >
      {app.mode === 'edit' ? 'View' : 'Edit'}
    </button>
  );
}

const editor: Plugin = {
  name: 'editor',
  setup(app) {
    app.addPane('edit', Editor);
    app.addOverlay(ModeToggle);
    app.command({
      id: 'view.toggleEdit',
      title: '表示 / 編集の切替',
      keys: ['Ctrl+E'],
      run: () => app.doc && app.setMode(app.mode === 'edit' ? 'view' : 'edit'),
    });
    app.command({ id: 'file.save', title: '保存', keys: ['Ctrl+S'], run: () => app.save() });
    app.backend.onCloseRequested(() => app.confirmDiscard());
  },
};
export default editor;
