// Markdown editor: a <textarea> with list continuation, indentation and save.
import { enter, indent, outdent, toggleWrap } from '../lib/markdown-edit.js';

/** Apply an Edit through the browser's editing commands so that Undo (Ctrl+Z) keeps working. */
function applyEdit(ta, edit) {
  ta.setSelectionRange(edit.from, edit.to);
  const ok = edit.insert === ''
    ? edit.from === edit.to || document.execCommand('delete')
    : document.execCommand('insertText', false, edit.insert);
  if (!ok) {
    ta.setRangeText(edit.insert, edit.from, edit.to, 'end');
    ta.dispatchEvent(new Event('input'));
  }
  ta.setSelectionRange(...edit.select);
}

const KEYS = {
  'Enter': enter,
  'Tab': indent,
  'Shift+Tab': outdent,
  'Ctrl+b': (s) => toggleWrap(s, '**'),
  'Ctrl+i': (s) => toggleWrap(s, '*'),
};

export default {
  name: 'editor',
  setup(app) {
    const ta = document.getElementById('editor');

    ta.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;       // IME conversion in progress
      const name = (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + e.key;
      const op = KEYS[name];
      if (!op) return;
      const edit = op({ text: ta.value, start: ta.selectionStart, end: ta.selectionEnd });
      e.preventDefault();
      if (edit) applyEdit(ta, edit);
    });
    ta.addEventListener('input', () => app.update(ta.value));

    app.on('doc:loaded', (doc, { reset }) => {
      if (ta.value === doc.raw) return;
      const { selectionStart: s, selectionEnd: e, scrollTop } = ta;
      ta.value = doc.raw;                     // also clears the undo history
      if (reset) return ta.setSelectionRange(0, 0);
      ta.setSelectionRange(s, e);
      ta.scrollTop = scrollTop;
    });
    app.on('mode:changed', (mode) => {
      ta.hidden = mode !== 'edit';
      if (mode === 'edit') ta.focus();
    });

    app.command('file.save', () => app.save(), ['Ctrl+S']);
    app.backend.onCloseRequested(() => app.confirmDiscard());
  },
};
