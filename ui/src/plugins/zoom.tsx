// Zoom with Ctrl+wheel and Ctrl +/-/0. The level is remembered between sessions.
// Panes read it from the CSS variable --zoom.
import type { App } from '../core/app';
import type { Plugin } from '../core/types';
import { useAppVersion } from '../core/useApp';

export const MIN = 0.5;
export const MAX = 3;
export const STEP = 0.1;

export function clampZoom(z: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));
}

let current = 1;

/** The zoom level in the status bar. Click to go back to 100%. */
function ZoomStatus({ app }: { app: App }) {
  useAppVersion(app);
  return (
    <button
      type="button"
      title={`${app.t('cmd.zoom.reset')} (Ctrl+0)`}
      onClick={() => app.run('zoom.reset')}
      className="rounded px-1.5 tabular-nums leading-5 hover:bg-line/60 focus-visible:outline-2 focus-visible:outline-link"
    >
      {Math.round(current * 100)}%
    </button>
  );
}

const zoom: Plugin = {
  name: 'zoom',
  setup(app) {
    let level = clampZoom(Number(app.storage.get('zoom')) || 1);
    const apply = () => {
      current = level;
      document.documentElement.style.setProperty('--zoom', String(level));
    };
    const set = (z: number) => {
      level = clampZoom(z);
      apply();
      app.storage.set('zoom', level);
      app.emit('plugin:zoom', level);
    };
    apply();

    app.addStatusItem(ZoomStatus, 50);
    app.command({
      id: 'zoom.in',
      title: 'cmd.zoom.in',
      keys: ['Ctrl++', 'Ctrl+=', 'Ctrl+;'],
      run: () => set(level + STEP),
    });
    app.command({ id: 'zoom.out', title: 'cmd.zoom.out', keys: ['Ctrl+-'], run: () => set(level - STEP) });
    app.command({ id: 'zoom.reset', title: 'cmd.zoom.reset', keys: ['Ctrl+0'], run: () => set(1) });
    app.addMenuItem({ menu: 'view', command: 'zoom.in', group: 10, order: 1 });
    app.addMenuItem({ menu: 'view', command: 'zoom.out', group: 10, order: 2 });
    app.addMenuItem({ menu: 'view', command: 'zoom.reset', group: 10, order: 3 });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        app.run(e.deltaY < 0 ? 'zoom.in' : 'zoom.out');
      },
      { passive: false },
    );
  },
};
export default zoom;
