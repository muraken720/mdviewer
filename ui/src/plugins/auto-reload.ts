// Re-render when the file changes on disk (e.g. while an AI tool is still writing it).
// Unsaved edits are never overwritten.
import type { App } from '../core/app';
import type { Plugin } from '../core/types';

export const INTERVAL_MS = 1000;

/** Reload if the open file's mtime changed. Resolves true if it reloaded. */
export async function checkForChange(app: App): Promise<boolean> {
  if (!app.doc || app.dirty) return false;
  const m = await app.backend.mtime(app.doc.path);
  if (!m || m === app.doc.mtime) return false;
  return app.reload();
}

const autoReload: Plugin = {
  name: 'auto-reload',
  setup(app) {
    setInterval(() => {
      if (!document.hidden) void checkForChange(app);
    }, INTERVAL_MS);
  },
};
export default autoReload;
