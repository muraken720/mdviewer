// Re-render when the file changes on disk (e.g. while an AI tool is still writing it).
// Unsaved edits are never overwritten.
import type { App } from '../core/app';
import type { Plugin } from '../core/types';

export const INTERVAL_MS = 1000;

/** Reload the active tab if its file's mtime changed. Resolves true if it reloaded. */
export async function checkForChange(app: App): Promise<boolean> {
  const tab = app.active;
  if (!tab.doc || tab.dirty) return false;
  const m = await app.backend.mtime(tab.doc.id);
  if (!m || m === tab.doc.mtime) return false;
  return app.reload({ tab });
}

const autoReload: Plugin = {
  name: 'auto-reload',
  setup(app) {
    // Only the visible tab is polled; a tab is checked as soon as it becomes active.
    setInterval(() => {
      if (!document.hidden) void checkForChange(app);
    }, INTERVAL_MS);
    app.on('tabs:changed', () => void checkForChange(app));
  },
};
export default autoReload;
