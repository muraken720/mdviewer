// Viewer pane: shows the rendered document (or the start screen / an error), plus toasts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StartScreen } from '../components/StartScreen';
import type { App } from '../core/app';
import type { Pane, PaneProps, Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { sanitize } from '../lib/sanitize';

/** The viewer pane. `scroll.reset` is set when a new document is opened. */
function createViewer(scroll: { reset: boolean }): Pane {
  return function Viewer({ app, active }: PaneProps) {
    useAppVersion(app);
    const ref = useRef<HTMLElement>(null);
    const html = app.doc?.html;
    const safeHtml = useMemo(() => (html === undefined ? '' : sanitize(html)), [html]);

    useLayoutEffect(() => {
      if (!ref.current || html === undefined) return;
      if (scroll.reset) {
        window.scrollTo(0, 0);
        scroll.reset = false;
      }
      app.emit('view:updated', ref.current);
    }, [app, html]);

    return (
      <main hidden={!active} className="mx-auto max-w-[900px] px-10 pt-8 pb-20 [zoom:var(--zoom,1)]">
        {app.error ? (
          <p className="text-caution">{app.error}</p>
        ) : app.doc ? (
          // Rendered by Rust, sanitised by lib/sanitize.ts, and scripts are blocked by the CSP in
          // src-tauri/tauri.conf.json. Plugins post-process it on `view:updated`.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised document HTML (see above)
          <article ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <StartScreen app={app} />
        )}
      </main>
    );
  };
}

function Toast({ app }: { app: App }) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = app.on('toast', (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 5000);
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
      className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md bg-caution px-4 py-2 text-sm text-white shadow"
    >
      {message}
    </div>
  );
}

const view: Plugin = {
  name: 'view',
  setup(app) {
    const scroll = { reset: false };
    app.addPane('view', createViewer(scroll));
    app.addOverlay(Toast);
    app.on('doc:loaded', (_doc, { reset }) => {
      if (reset) scroll.reset = true;
    });
  },
};
export default view;
