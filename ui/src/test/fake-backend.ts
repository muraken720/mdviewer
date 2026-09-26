// In-memory Backend for tests.
import type { Backend, Doc } from '../core/types';

export interface FakeBackend extends Backend {
  calls: unknown[][];
  fs: Map<string, { raw: string; mtime: number }>;
  answer: boolean;
}

export function fakeBackend(files: Record<string, string> = {}, { answer = true } = {}): FakeBackend {
  const calls: unknown[][] = [];
  const fs = new Map(Object.entries(files).map(([p, raw]) => [p, { raw, mtime: 1 }]));
  const backend: FakeBackend = {
    calls,
    fs,
    answer,
    settings: async () => ({}),
    async load(path, base = null): Promise<Doc> {
      calls.push(['load', path, base]);
      const f = fs.get(path);
      if (!f) throw new Error(`not found: ${path}`);
      return { path, name: path.split('/').pop()!, raw: f.raw, html: `<p>${f.raw}</p>`, mtime: f.mtime };
    },
    async render(text) {
      calls.push(['render', text]);
      return `<p>${text}</p>`;
    },
    async save(path, text) {
      const mtime = (fs.get(path)?.mtime ?? 0) + 1;
      fs.set(path, { raw: text, mtime });
      calls.push(['save', path, text]);
      return mtime;
    },
    mtime: async (path) => fs.get(path)?.mtime ?? 0,
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
    onDrop() {},
    onCloseRequested() {},
  };
  return backend;
}
