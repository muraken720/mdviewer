// Viewer pane (one per tab): the rendered document in its own scroll area, or the start screen.
// Also shows toasts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StartScreen } from '../components/StartScreen';
import type { App } from '../core/app';
import type { PaneProps, Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { sanitize } from '../lib/sanitize';

function Viewer({ app, tab, active }: PaneProps) {
  useAppVersion(app);
  const scroller = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const html = tab.doc?.html;
  const safeHtml = useMemo(() => (html === undefined ? '' : sanitize(html)), [html]);

  useLayoutEffect(() => {
    if (article.current && html !== undefined) app.emit('view:updated', article.current, tab);
  }, [app, tab, html]);

  // Restore this tab's scroll position when it is shown or a page is loaded (history, reload).
  const doc = tab.doc;
  useLayoutEffect(() => {
    if (active && scroller.current && doc) scroller.current.scrollTop = tab.scroll;
  }, [active, doc, tab]);

  return (
    <div
      ref={scroller}
      hidden={!active}
      data-viewer={tab.id}
      onScroll={(e) => {
        tab.scroll = e.currentTarget.scrollTop;
      }}
      className="h-full overflow-auto print:overflow-visible"
    >
      <main className="mx-auto max-w-[900px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8 lg:px-10 [zoom:var(--zoom,1)]">
        {tab.doc ? (
          // Rendered by Rust, sanitised by lib/sanitize.ts, and scripts are blocked by the CSP in
          // src-tauri/tauri.conf.json. Plugins post-process it on `view:updated`.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised document HTML (see above)
          <article ref={article} className="markdown" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <StartScreen app={app} />
        )}
      </main>
    </div>
  );
}

function Toast({ app }: { app: App }) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = app.on('toast', (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 6000);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [app]);
  if (!message) return null;
  return (
    <div
      role="alert"
      className="-translate-x-1/2 fixed bottom-4 left-1/2 z-30 w-max max-w-[calc(100vw-2rem)] break-words rounded-md bg-caution px-4 py-2 text-sm text-white shadow"
    >
      {message}
    </div>
  );
}

const view: Plugin = {
  name: 'view',
  setup(app) {
    app.addPane('view', Viewer);
    app.addOverlay(Toast);
  },
};
export default view;
