// Re-render when the file changes on disk (e.g. while an AI tool is still writing it).
// Unsaved edits are never overwritten.
export const INTERVAL_MS = 1000;

/** Reload if the open file's mtime changed. Returns true if a reload was triggered. */
export async function checkForChange(app) {
  if (!app.doc || app.dirty) return false;
  const m = await app.backend.mtime(app.doc.path);
  if (!m || m === app.doc.mtime) return false;
  return app.reload();
}

export default {
  name: 'auto-reload',
  setup(app) {
    setInterval(() => {
      if (!document.hidden) checkForChange(app);
    }, INTERVAL_MS);
  },
};
