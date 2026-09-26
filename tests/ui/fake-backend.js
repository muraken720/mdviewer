// In-memory Backend for tests.
export function fakeBackend(files = {}, { answer = true } = {}) {
  const calls = [];
  const fs = new Map(Object.entries(files).map(([p, raw]) => [p, { raw, mtime: 1 }]));
  return {
    calls,
    fs,
    answer,
    async load(path, base = null) {
      calls.push(['load', path, base]);
      const f = fs.get(path);
      if (!f) throw new Error(`not found: ${path}`);
      return { path, name: path.split('/').pop(), raw: f.raw, html: `<p>${f.raw}</p>`, mtime: f.mtime };
    },
    async render(text) { calls.push(['render', text]); return `<p>${text}</p>`; },
    async save(path, text) {
      const mtime = (fs.get(path)?.mtime ?? 0) + 1;
      fs.set(path, { raw: text, mtime });
      calls.push(['save', path, text]);
      return mtime;
    },
    async mtime(path) { return fs.get(path)?.mtime ?? 0; },
    async pickFile() { return null; },
    async ask(message) { calls.push(['ask', message]); return this.answer; },
    async openUrl(url) { calls.push(['openUrl', url]); },
    async initialPath() { return null; },
    async setTitle(t) { calls.push(['setTitle', t]); },
    onDrop() {},
    onCloseRequested() {},
  };
}
