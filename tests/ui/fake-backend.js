// In-memory Backend for tests.
export function fakeBackend(files = {}) {
  const calls = [];
  const fs = new Map(Object.entries(files).map(([p, raw]) => [p, { raw, mtime: 1 }]));
  return {
    calls,
    fs,
    async load(path, base = null) {
      calls.push(['load', path, base]);
      const f = fs.get(path);
      if (!f) throw new Error(`not found: ${path}`);
      return { path, name: path.split('/').pop(), raw: f.raw, html: `<p>${f.raw}</p>`, mtime: f.mtime };
    },
    async mtime(path) { return fs.get(path)?.mtime ?? 0; },
    async pickFile() { return null; },
    async openUrl(url) { calls.push(['openUrl', url]); },
    async initialPath() { return null; },
    onDrop() {},
  };
}
