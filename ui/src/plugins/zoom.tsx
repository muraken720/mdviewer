// Zoom with Ctrl+wheel and Ctrl +/-/0. The level is remembered between sessions.
// Panes read it from the CSS variable --zoom.
import { useEffect, useState } from 'react';
import type { App } from '../core/app';
import type { Plugin } from '../core/types';

export const MIN = 0.5;
export const MAX = 3;
export const STEP = 0.1;

export function clampZoom(z: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));
}

function ZoomBadge({ app }: { app: App }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = app.on('plugin:zoom', (z) => {
      setLabel(`${Math.round((z as number) * 100)}%`);
      clearTimeout(timer);
      timer = setTimeout(() => setLabel(null), 800);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [app]);
  if (!label) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-10 rounded-md bg-fg px-2.5 py-1 text-xs text-bg">{label}</div>
  );
}

const zoom: Plugin = {
  name: 'zoom',
  setup(app) {
    let level = clampZoom(Number(app.storage.get('zoom')) || 1);
    const apply = () => document.documentElement.style.setProperty('--zoom', String(level));
    const set = (z: number) => {
      level = clampZoom(z);
      apply();
      app.storage.set('zoom', level);
      app.emit('plugin:zoom', level);
    };
    apply();

    app.addOverlay(ZoomBadge);
    app.command({ id: 'zoom.in', title: '拡大（Ctrl+ホイールでも可）', keys: ['Ctrl+=', 'Ctrl++', 'Ctrl+;'], run: () => set(level + STEP) });
    app.command({ id: 'zoom.out', title: '縮小', keys: ['Ctrl+-'], run: () => set(level - STEP) });
    app.command({ id: 'zoom.reset', title: '100% に戻す', keys: ['Ctrl+0'], run: () => set(1) });

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
