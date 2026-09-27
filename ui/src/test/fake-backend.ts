// In-memory Backend for tests. Like the real one, documents are addressed by id after opening.
import type { Backend, Doc } from '../core/types';

export interface FakeBackend extends Backend {
  calls: unknown[][];
  fs: Map<string, { raw: string; mtime: number }>;
  /** Open documents: id → path. */
  docs: Map<number, string>;
  answer: boolean;
}

export function fakeBackend(files: Record<string, string> = {}, { answer = true } = {}): FakeBackend {
  const calls: unknown[][] = [];
  const fs = new Map(Object.entries(files).map(([p, raw]) => [p, { raw, mtime: 1 }]));
  const docs = new Map<number, string>();
  let nextId = 0;

  const read = (path: string, id = ++nextId): Doc => {
    const f = fs.get(path);
    if (!f) throw { code: 'io', detail: `not found: ${path}` };
    docs.set(id, path);
    return { id, path, name: path.split('/').pop() ?? path, raw: f.raw, html: `<p>${f.raw}</p>`, mtime: f.mtime };
  };
  const pathOf = (id: number): string => {
    const path = docs.get(id);
    if (!path) throw { code: 'unknown-document' };
    return path;
  };

  const backend: FakeBackend = {
    calls,
    fs,
    docs,
    answer,
    settings: async () => ({}),
    appInfo: async () => ({ name: 'mdviewer', version: '0.0.0', authors: 'A', license: 'MIT', repository: 'r' }),
    async open(path) {
      calls.push(['open', path]);
      return read(path);
    },
    async openLink(from, href) {
      calls.push(['openLink', from, href]);
      const dir = pathOf(from).replace(/[^/]*$/, '');
      return read(dir + href);
    },
    async reload(id) {
      return read(pathOf(id), id);
    },
    async render(_id, text) {
      calls.push(['render', text]);
      return `<p>${text}</p>`;
    },
    async save(id, text) {
      const path = pathOf(id);
      const mtime = (fs.get(path)?.mtime ?? 0) + 1;
      fs.set(path, { raw: text, mtime });
      calls.push(['save', path, text]);
      return mtime;
    },
    mtime: async (id) => fs.get(docs.get(id) ?? '')?.mtime ?? 0,
    async closeDoc(id) {
      docs.delete(id);
    },
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
    async setTheme(theme) {
      calls.push(['setTheme', theme]);
    },
    async showWindow() {
      calls.push(['showWindow']);
    },
    async closeWindow() {
      calls.push(['closeWindow']);
    },
    onOpenRequest() {},
    onCloseRequested() {},
  };
  return backend;
}
