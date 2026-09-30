// Table of contents at the right of the document, in view mode, when the window is wide enough.
// The first entry is the document title (the first level 1 heading, else the file name) and goes
// back to the top; below it come the level 2 and 3 headings. The section being read is highlighted
// and a click scrolls to it. The document column does not move: the
// list sits in the empty margin, and it is hidden when there is no room. View menu → on / off.
import { type MouseEvent, useEffect, useState, type WheelEvent } from 'react';
import type { App } from '../core/app';
import type { Tab } from '../core/tab';
import type { Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Headings with an id (added by the heading-anchors plugin on the Rust side). */
export function collectHeadings(root: ParentNode): TocEntry[] {
  return [...root.querySelectorAll('h2[id], h3[id]')]
    .map((h) => ({ id: h.id, text: h.textContent?.trim() ?? '', level: h.tagName === 'H2' ? 2 : 3 }) as TocEntry)
    .filter((e) => e.text !== '');
}

/** The document title: the first level 1 heading, else `fallback` (the file name). */
export function documentTitle(root: ParentNode, fallback: string): string {
  return root.querySelector('h1')?.textContent?.trim() || fallback;
}

/** Shorter documents get no table of contents. */
export const MIN_ENTRIES = 3;
/** Narrower windows get no table of contents. */
export const MIN_WINDOW = 1280;
/** Maximum width of the document column (view.tsx), before zoom. */
const DOC_WIDTH = 900;

/** Width of the table of contents, or 0 when there is no room right of the document. */
export function tocWidth(windowWidth: number, zoom: number): number {
  if (windowWidth < MIN_WINDOW) return 0;
  const margin = (windowWidth - DOC_WIDTH * zoom) / 2;
  const width = Math.min(260, margin - 8);
  return width >= 160 ? width : 0;
}

const headings = new WeakMap<Tab, { title: string; entries: TocEntry[] }>();
const NONE: TocEntry[] = [];
/** `current` value while the top of the document (above the first heading) is shown. */
const TOP = '';
let shown = true;

const zoom = () => Number(document.documentElement.style.getPropertyValue('--zoom')) || 1;
const viewerOf = (tab: Tab) => document.querySelector<HTMLElement>(`[data-viewer="${tab.id}"]`);
const headingIn = (scroller: HTMLElement, id: string) => scroller.querySelector(`[id="${CSS.escape(id)}"]`);

/** The heading whose section is at the top of the viewer, or TOP above the first heading. */
function currentSection(scroller: HTMLElement, entries: TocEntry[]): string {
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) return entries.at(-1)?.id ?? TOP;
  const top = scroller.getBoundingClientRect().top + 80;
  let current = TOP;
  for (const e of entries) {
    const el = headingIn(scroller, e.id);
    if (!el) continue;
    if (el.getBoundingClientRect().top > top) break;
    current = e.id;
  }
  return current;
}

function Toc({ app }: { app: App }) {
  useAppVersion(app);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [current, setCurrent] = useState(TOP);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const tab = app.active;
  const found = headings.get(tab);
  const entries = found?.entries ?? NONE;
  const visible = shown && !!tab.doc && tab.mode === 'view' && entries.length >= MIN_ENTRIES;
  const width = visible ? tocWidth(windowWidth, zoom()) : 0;

  // Follow the scroll position (at most once per frame).
  useEffect(() => {
    const scroller = width ? viewerOf(tab) : null;
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setCurrent(currentSection(scroller, entries));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [tab, entries, width]);

  if (!width) return null;

  const jump = (e: MouseEvent, id: string) => {
    e.preventDefault();
    const scroller = viewerOf(tab);
    if (!scroller) return;
    if (id === TOP) scroller.scrollTo({ top: 0 });
    else headingIn(scroller, id)?.scrollIntoView();
  };
  const item = (id: string, text: string, indent: string, key: string) => {
    const active = id === current;
    return (
      <li key={key}>
        <a
          href={`#${id}`}
          aria-current={active ? 'location' : undefined}
          onClick={(ev) => jump(ev, id)}
          className={`-ml-px block border-l-2 py-1 pr-1 focus-visible:outline-2 focus-visible:outline-link ${indent} ${
            active ? 'border-link font-semibold text-link' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {text}
        </a>
      </li>
    );
  };
  // The wheel over a short list scrolls the document, as it does over the rest of the margin.
  const onWheel = (e: WheelEvent<HTMLElement>) => {
    const nav = e.currentTarget;
    if (e.ctrlKey || nav.scrollHeight > nav.clientHeight) return;
    viewerOf(tab)?.scrollBy({ top: e.deltaY });
  };

  return (
    <nav
      aria-label={app.t('toc.title')}
      style={{ width }}
      onWheel={onWheel}
      className="absolute top-6 right-5 max-h-[calc(100%-3rem)] overflow-y-auto text-[13px] leading-snug print:hidden sm:top-8"
    >
      <ul className="border-line border-l">
        {item(TOP, found?.title ?? '', 'pl-3 font-semibold', 'top')}
        {entries.map((e) => item(e.id, e.text, e.level === 3 ? 'pl-6' : 'pl-3', e.id))}
      </ul>
    </nav>
  );
}

const toc: Plugin = {
  name: 'toc',
  setup(app) {
    shown = app.storage.get('toc') !== '0';
    app.on('view:updated', (root, tab) =>
      headings.set(tab, { title: documentTitle(root, tab.doc?.name ?? ''), entries: collectHeadings(root) }),
    );
    app.addOverlay(Toc);
    app.command({
      id: 'view.toc',
      title: 'cmd.view.toc',
      run: () => {
        shown = !shown;
        app.storage.set('toc', shown ? 1 : 0);
        app.emit('plugin:toc', shown);
      },
      checked: () => shown,
    });
    app.addMenuItem({ menu: 'view', command: 'view.toc', group: 20 });
  },
};
export default toc;
