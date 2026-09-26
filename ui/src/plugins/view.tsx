// Viewer pane: shows the rendered document (or the start screen / an error), plus toasts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { App } from '../core/app';
import type { PaneProps, Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';
import { StartScreen } from '../components/StartScreen';

let resetScroll = false; // scroll to top after the next render (a new document was opened)

function Viewer({ app, active }: PaneProps) {
  useAppVersion(app);
  const ref = useRef<HTMLElement>(null);
  const html = app.doc?.html;

  useLayoutEffect(() => {
    if (!ref.current || html === undefined) return;
    if (resetScroll) {
      window.scrollTo(0, 0);
      resetScroll = false;
    }
    app.emit('view:updated', ref.current);
  }, [app, html]);

  return (
    <main hidden={!active} className="mx-auto max-w-[900px] px-10 pt-8 pb-20 [zoom:var(--zoom,1)]">
      {app.error ? (
        <p className="text-caution">{app.error}</p>
      ) : app.doc ? (
        <article ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: html ?? '' }} />
      ) : (
        <StartScreen app={app} />
      )}
    </main>
  );
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
    <div role="alert" className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md bg-caution px-4 py-2 text-sm text-white shadow">
      {message}
    </div>
  );
}

const view: Plugin = {
  name: 'view',
  setup(app) {
    app.addPane('view', Viewer);
    app.addOverlay(Toast);
    app.on('doc:loaded', (_doc, { reset }) => {
      if (reset) resetScroll = true;
    });
  },
};
export default view;
