// Zoom with Ctrl+wheel and Ctrl +/-/0. The level is remembered between sessions.
export const MIN = 0.5;
export const MAX = 3;
export const STEP = 0.1;

export function clampZoom(z) {
  return Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));
}

export default {
  name: 'zoom',
  setup(app) {
    const targets = [document.getElementById('view'), document.getElementById('raw')];
    const $badge = document.getElementById('zoom');
    let zoom = clampZoom(Number(app.storage.get('zoom')) || 1);
    let timer;

    const set = (z, show = true) => {
      zoom = clampZoom(z);
      for (const t of targets) t.style.zoom = zoom;
      app.storage.set('zoom', zoom);
      if (!show) return;
      $badge.textContent = `${Math.round(zoom * 100)}%`;
      $badge.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => ($badge.hidden = true), 800);
    };
    set(zoom, false);

    app.command('zoom.in', () => set(zoom + STEP), ['Ctrl+=', 'Ctrl++', 'Ctrl+;']);
    app.command('zoom.out', () => set(zoom - STEP), ['Ctrl+-']);
    app.command('zoom.reset', () => set(1), ['Ctrl+0']);

    window.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      app.run(e.deltaY < 0 ? 'zoom.in' : 'zoom.out');
    }, { passive: false });
  },
};
