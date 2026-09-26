// In-memory Backend for tests. Like the real one, it tracks the current document and only
// reads/writes that one for reload/render/save/mtime.
import type { Backend, Doc } from '../core/types';

export interface FakeBackend extends Backend {
  calls: unknown[][];
  fs: Map<string, { raw: string; mtime: number }>;
  answer: boolean;
  current: string | null;
}

export function fakeBackend(files: Record<string, string> = {}, { answer = true } = {}): FakeBackend {
  const calls: unknown[][] = [];
  const fs = new Map(Object.entries(files).map(([p, raw]) => [p, { raw, mtime: 1 }]));

  const read = (path: string): Doc => {
    const f = fs.get(path);
    if (!f) throw new Error(`not found: ${path}`);
    backend.current = path;
    return { path, name: path.split('/').pop() ?? path, raw: f.raw, html: `<p>${f.raw}</p>`, mtime: f.mtime };
  };
  const current = (): string => {
    if (!backend.current) throw new Error('no document');
    return backend.current;
  };

  const backend: FakeBackend = {
    calls,
    fs,
    answer,
    current: null,
    settings: async () => ({}),
    async open(path) {
      calls.push(['open', path]);
      return read(path);
    },
    async openLink(href) {
      calls.push(['openLink', href]);
      const dir = current().replace(/[^/]*$/, '');
      return read(dir + href);
    },
    async reload() {
      return read(current());
    },
    async render(text) {
      calls.push(['render', text]);
      return `<p>${text}</p>`;
    },
    async save(text) {
      const path = current();
      const mtime = (fs.get(path)?.mtime ?? 0) + 1;
      fs.set(path, { raw: text, mtime });
      calls.push(['save', path, text]);
      return mtime;
    },
    mtime: async () => (backend.current ? (fs.get(backend.current)?.mtime ?? 0) : 0),
    pickFile: async () => null,
    async ask(message) {
      calls.push(['ask', message]);
      return backend.answer;
    },
    async openUrl(url) {
      calls.push(['openUrl', url]);
    },
    initialPath: async () => null,
    async setTitle(t) {
      calls.push(['setTitle', t]);
    },
    onOpenRequest() {},
    onCloseRequested() {},
  };
  return backend;
}
