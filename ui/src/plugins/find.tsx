// Find in the current document (Ctrl+F). In the viewer, matches are highlighted with the CSS
// Custom Highlight API (the document DOM is not modified); in the editor, the match is selected.
import { useEffect, useRef, useState } from 'react';
import type { App } from '../core/app';
import type { Plugin } from '../core/types';
import { findAll, textRanges } from '../lib/find';

const hasHighlights = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

function viewerOf(app: App): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-viewer="${app.active.id}"] article`);
}
function editorOf(app: App): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(`[data-editor="${app.active.id}"]`);
}

function clearHighlights() {
  if (!hasHighlights()) return;
  CSS.highlights.delete('find');
  CSS.highlights.delete('find-current');
}

function FindBar({ app }: { app: App }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0); // bumps when the document or tab changes
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const offs = [
      app.on('plugin:find-open', () => {
        setOpen(true);
        const selected = window.getSelection()?.toString();
        if (selected && !selected.includes('\n')) setQuery(selected);
        requestAnimationFrame(() => input.current?.select());
      }),
      app.on('plugin:find-step', (step) => setIndex((i) => i + (step as number))),
      app.on('view:updated', () => setVersion((v) => v + 1)),
      app.on('tabs:changed', () => setVersion((v) => v + 1)),
      app.on('mode:changed', () => setVersion((v) => v + 1)),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [app]);

  // Recompute matches and show the current one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the search when the document or tab changes
  useEffect(() => {
    if (!open) {
      clearHighlights();
      return;
    }
    if (app.mode === 'edit') {
      clearHighlights();
      const ta = editorOf(app);
      const matches = ta ? findAll(ta.value, query, matchCase) : [];
      setTotal(matches.length);
      const current = matches.length ? matches[((index % matches.length) + matches.length) % matches.length] : null;
      if (ta && current && index !== 0) {
        // Selecting in an unfocused textarea is invisible, so move focus there (F3 continues).
        ta.focus();
        ta.setSelectionRange(current.start, current.end);
      }
      return;
    }
    const root = viewerOf(app);
    const ranges = root ? textRanges(root, query, matchCase) : [];
    setTotal(ranges.length);
    const current = ranges.length ? ranges[((index % ranges.length) + ranges.length) % ranges.length] : null;
    if (hasHighlights()) {
      CSS.highlights.set('find', new Highlight(...ranges));
      if (current) CSS.highlights.set('find-current', new Highlight(current));
      else CSS.highlights.delete('find-current');
    }
    current?.startContainer.parentElement?.scrollIntoView?.({ block: 'center' });
  }, [app, open, query, matchCase, index, version]);

  useEffect(() => clearHighlights, []);

  if (!open) return null;
  const shown = total ? (((index % total) + total) % total) + 1 : 0;
  const close = () => {
    setOpen(false);
    setIndex(0);
  };
  const btn = 'h-7 w-7 shrink-0 rounded hover:bg-line/60 focus-visible:outline-2 focus-visible:outline-link';
  return (
    <search className="absolute top-12 right-5 left-4 z-20 flex sm:top-2 sm:right-48 sm:left-auto sm:w-[min(24rem,calc(100%-13rem))] items-center gap-1 rounded-md border border-line bg-bg p-1 shadow-md print:hidden">
      <input
        ref={input}
        type="search"
        value={query}
        placeholder={app.t('find.placeholder')}
        aria-label={app.t('find.placeholder')}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setIndex((i) => i + (e.shiftKey ? -1 : 1));
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none"
      />
      <span aria-live="polite" className="shrink-0 px-1 text-muted text-xs">
        {query && (total ? app.t('find.count', { current: shown, total }) : app.t('find.none'))}
      </span>
      <button
        type="button"
        aria-pressed={matchCase}
        title={app.t('find.matchCase')}
        aria-label={app.t('find.matchCase')}
        onClick={() => setMatchCase((v) => !v)}
        className={`${btn} text-xs ${matchCase ? 'bg-line' : ''}`}
      >
        Aa
      </button>
      <button
        type="button"
        title={app.t('find.prev')}
        aria-label={app.t('find.prev')}
        onClick={() => setIndex((i) => i - 1)}
        className={btn}
      >
        ↑
      </button>
      <button
        type="button"
        title={app.t('find.next')}
        aria-label={app.t('find.next')}
        onClick={() => setIndex((i) => i + 1)}
        className={btn}
      >
        ↓
      </button>
      <button
        type="button"
        title={app.t('find.close')}
        aria-label={app.t('find.close')}
        onClick={close}
        className={btn}
      >
        ×
      </button>
    </search>
  );
}

const find: Plugin = {
  name: 'find',
  setup(app) {
    app.addOverlay(FindBar);
    app.command({
      id: 'find.open',
      title: 'cmd.find.open',
      keys: ['Ctrl+F'],
      run: () => app.emit('plugin:find-open'),
      enabled: () => !!app.doc,
    });
    app.command({ id: 'find.next', keys: ['F3'], run: () => app.emit('plugin:find-step', 1) });
    app.command({ id: 'find.prev', keys: ['Shift+F3'], run: () => app.emit('plugin:find-step', -1) });
    app.addMenuItem({ menu: 'edit', command: 'find.open', group: 20 });
  },
};
export default find;
