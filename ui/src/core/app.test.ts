import { describe, expect, test } from 'vitest';
import { fakeBackend } from '../test/fake-backend';
import { App, DISCARD_MESSAGE, isPluginEnabled, keySpec, OVERWRITE_MESSAGE } from './app';
import type { Pane } from './types';

const Dummy: Pane = () => null;
function appWith(files: Record<string, string> = {}, opts?: { answer?: boolean }) {
  const backend = fakeBackend(files, opts);
  const app = new App({ backend });
  app.addPane('view', Dummy);
  app.addPane('edit', Dummy);
  return { app, backend };
}

describe('keySpec', () => {
  test('normalises strings and events identically', () => {
    expect(keySpec('Ctrl+E')).toBe('ctrl+e');
    expect(keySpec({ key: 'E', ctrlKey: true, shiftKey: true })).toBe('ctrl+shift+e');
    expect(keySpec({ key: 'e', metaKey: true })).toBe('ctrl+e');
    expect(keySpec('Ctrl++')).toBe('ctrl++');
    // Shift is implied by the symbol itself (JIS keyboards: Shift+; = "+")
    expect(keySpec({ key: '+', ctrlKey: true, shiftKey: true })).toBe('ctrl++');
    expect(keySpec('F5')).toBe('f5');
  });
});

test('commands run via keymap', () => {
  const { app } = appWith();
  let n = 0;
  app.command({ id: 'x.inc', keys: ['Ctrl+K'], run: () => n++ });
  expect(app.handleKey({ key: 'k', ctrlKey: true })).toBe(true);
  expect(app.handleKey({ key: 'k' })).toBe(false);
  expect(n).toBe(1);
  expect(() => app.command({ id: 'x.inc', run: () => {} })).toThrow(/already registered/);
  expect(() => app.run('nope')).toThrow(/unknown command/);
});

test('open emits doc:loaded; errors are shown and keep the current doc', async () => {
  const { app } = appWith({ '/a.md': '# A' });
  const seen: unknown[] = [];
  app.on('doc:loaded', (doc, opts) => seen.push(['loaded', doc.path, opts.reset]));
  app.on('doc:error', (e) => seen.push(['error', (e as Error).message]));
  await app.open('/a.md');
  await app.reload();
  await app.open('/missing.md');
  expect(seen).toEqual([
    ['loaded', '/a.md', true],
    ['loaded', '/a.md', false],
    ['error', 'not found: /missing.md'],
  ]);
  expect(app.doc?.path).toBe('/a.md');
  expect(app.error).toMatch(/not found/);
  await app.open('/a.md');
  expect(app.error).toBeNull();
});

test('mode changes need a pane and are emitted once', async () => {
  const backend = fakeBackend();
  const app = new App({ backend });
  app.addPane('view', Dummy);
  await app.setMode('edit');
  expect(app.mode).toBe('view');

  const { app: full } = appWith();
  const modes: string[] = [];
  full.on('mode:changed', (m) => modes.push(m));
  await full.setMode('edit');
  await full.setMode('edit');
  await full.setMode('view');
  expect(modes).toEqual(['edit', 'view']);
});

test('editing marks the doc dirty; switching to view re-renders once', async () => {
  const { app } = appWith({ '/a.md': 'v1' });
  const events: unknown[] = [];
  app.on('doc:dirty', (d) => events.push(['dirty', d]));
  app.on('doc:rendered', (doc) => events.push(['rendered', doc.html]));
  await app.open('/a.md');
  await app.setMode('edit');
  app.update('v2');
  app.update('v3');
  expect(app.dirty).toBe(true);
  await app.setMode('view');
  await app.setMode('edit');
  await app.setMode('view');
  expect(events).toEqual([
    ['dirty', false],
    ['dirty', true],
    ['rendered', '<p>v3</p>'],
  ]);
  app.update('v1');
  expect(app.dirty).toBe(false);
});

test('save writes, clears dirty and keeps mtime in sync', async () => {
  const { app, backend } = appWith({ '/a.md': 'v1' });
  await app.open('/a.md');
  app.update('v2');
  expect(await app.save()).toBe(true);
  expect(app.dirty).toBe(false);
  expect(backend.fs.get('/a.md')?.raw).toBe('v2');
  expect(app.doc?.mtime).toBe(backend.fs.get('/a.md')?.mtime);
  expect(await app.reload()).toBe(true);
  expect(app.doc?.raw).toBe('v2');
});

test('save asks before overwriting an external change', async () => {
  const { app, backend } = appWith({ '/a.md': 'v1' }, { answer: false });
  await app.open('/a.md');
  backend.fs.set('/a.md', { raw: 'external', mtime: 5 });
  app.update('mine');
  expect(await app.save()).toBe(false);
  expect(backend.calls.at(-1)).toEqual(['ask', OVERWRITE_MESSAGE]);
  expect(backend.fs.get('/a.md')?.raw).toBe('external');
});

test('a failed save is reported as a toast', async () => {
  const { app, backend } = appWith({ '/a.md': 'v1' });
  backend.save = async () => {
    throw new Error('disk full');
  };
  const toasts: string[] = [];
  app.on('toast', (m) => toasts.push(m));
  await app.open('/a.md');
  app.update('v2');
  expect(await app.save()).toBe(false);
  expect(app.dirty).toBe(true);
  expect(toasts[0]).toMatch(/disk full/);
});

test('links open relative to the current document', async () => {
  const { app, backend } = appWith({ '/docs/a.md': 'a', '/docs/sub/b.md': 'b' });
  await app.open('/docs/a.md');
  await app.openLink('sub/b.md');
  expect(app.doc?.path).toBe('/docs/sub/b.md');
  expect(backend.calls.at(-1)).toEqual(['openLink', 'sub/b.md']);
});

test('unsaved edits are protected from reload and open', async () => {
  const { app, backend } = appWith({ '/a.md': 'v1', '/b.md': 'b' }, { answer: false });
  await app.open('/a.md');
  app.update('edited');
  backend.fs.set('/a.md', { raw: 'external', mtime: 9 });

  expect(await app.reload()).toBe(false);
  await app.open('/b.md');
  expect(app.doc?.path).toBe('/a.md');
  expect(backend.calls.at(-1)).toEqual(['ask', DISCARD_MESSAGE]);

  backend.answer = true;
  await app.open('/b.md');
  expect(app.doc?.path).toBe('/b.md');
  expect(await app.confirmDiscard()).toBe(true);
});

test('plugins are set up once, in order; contributions are collected', () => {
  const { app } = appWith();
  const order: string[] = [];
  const Overlay = () => null;
  app.use({ name: 'a', setup: () => order.push('a') }).use({
    name: 'b',
    setup: (a) => {
      order.push('b');
      a.addOverlay(Overlay);
    },
  });
  expect(order).toEqual(['a', 'b']);
  expect(app.plugins()).toEqual(['a', 'b']);
  expect(app.overlays()).toEqual([Overlay]);
  expect(() => app.use({ name: 'a', setup() {} })).toThrow(/already registered/);
});

test('subscribers are notified on every event', () => {
  const { app } = appWith();
  let n = 0;
  const off = app.subscribe(() => n++);
  const v = app.getVersion();
  app.emit('toast', 'x');
  off();
  app.emit('toast', 'y');
  expect(n).toBe(1);
  expect(app.getVersion()).toBe(v + 2);
});

test('isPluginEnabled honours settings and defaults', () => {
  expect(isPluginEnabled({ name: 'on' })).toBe(true);
  expect(isPluginEnabled({ name: 'off', enabledByDefault: false })).toBe(false);
  expect(isPluginEnabled({ name: 'off', enabledByDefault: false }, { plugins: { off: true } })).toBe(true);
  expect(isPluginEnabled({ name: 'on' }, { plugins: { on: false } })).toBe(false);
});
