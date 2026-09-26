import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, keySpec, isPluginEnabled, DISCARD_MESSAGE, OVERWRITE_MESSAGE } from '../../ui/core.js';
import { fakeBackend } from './fake-backend.js';

test('keySpec normalises strings and events identically', () => {
  assert.equal(keySpec('Ctrl+E'), 'ctrl+e');
  assert.equal(keySpec({ key: 'E', ctrlKey: true, shiftKey: true }), 'ctrl+shift+e');
  assert.equal(keySpec({ key: 'e', metaKey: true }), 'ctrl+e');
  assert.equal(keySpec('Ctrl++'), 'ctrl++');
  // Shift is implied by the symbol itself (JIS keyboards: Shift+; = "+")
  assert.equal(keySpec({ key: '+', ctrlKey: true, shiftKey: true }), 'ctrl++');
  assert.equal(keySpec('F5'), 'f5');
});

test('commands run via keymap', () => {
  const app = createApp({ backend: fakeBackend() });
  let n = 0;
  app.command('x.inc', () => n++, ['Ctrl+K']);
  assert.equal(app.handleKey({ key: 'k', ctrlKey: true }), true);
  assert.equal(app.handleKey({ key: 'k' }), false);
  assert.equal(n, 1);
  assert.throws(() => app.command('x.inc', () => {}), /already registered/);
  assert.throws(() => app.run('nope'), /unknown command/);
});

test('open emits doc:loaded, errors emit doc:error', async () => {
  const app = createApp({ backend: fakeBackend({ '/a.md': '# A' }) });
  const seen = [];
  app.on('doc:loaded', (doc, opts) => seen.push(['loaded', doc.path, opts.reset]));
  app.on('doc:error', (e) => seen.push(['error', e.message]));
  await app.open('/a.md');
  await app.reload();
  await app.open('/missing.md');
  assert.deepEqual(seen, [
    ['loaded', '/a.md', true],
    ['loaded', '/a.md', false],
    ['error', 'not found: /missing.md'],
  ]);
  assert.equal(app.doc.path, '/a.md', 'failed open keeps the current doc');
});

test('mode changes are emitted once', async () => {
  const app = createApp({ backend: fakeBackend() });
  const modes = [];
  app.on('mode:changed', (m) => modes.push(m));
  await app.setMode('edit');
  await app.setMode('edit');
  await app.setMode('view');
  assert.deepEqual(modes, ['edit', 'view']);
});

test('editing marks the doc dirty; switching to view re-renders once', async () => {
  const backend = fakeBackend({ '/a.md': 'v1' });
  const app = createApp({ backend });
  const events = [];
  app.on('doc:dirty', (d) => events.push(['dirty', d]));
  app.on('doc:rendered', (doc) => events.push(['rendered', doc.html]));
  await app.open('/a.md');
  await app.setMode('edit');
  app.update('v2');
  app.update('v3');
  assert.equal(app.dirty, true);
  await app.setMode('view');
  await app.setMode('edit');
  await app.setMode('view');
  assert.deepEqual(events, [['dirty', false], ['dirty', true], ['rendered', '<p>v3</p>']]);
  app.update('v1');
  assert.equal(app.dirty, false, 'back to the saved text');
});

test('save writes, clears dirty and keeps mtime in sync', async () => {
  const backend = fakeBackend({ '/a.md': 'v1' });
  const app = createApp({ backend });
  await app.open('/a.md');
  app.update('v2');
  assert.equal(await app.save(), true);
  assert.equal(app.dirty, false);
  assert.equal(backend.fs.get('/a.md').raw, 'v2');
  assert.equal(app.doc.mtime, backend.fs.get('/a.md').mtime);
  assert.equal(await app.reload(), true);
  assert.equal(app.doc.raw, 'v2');
});

test('save asks before overwriting an external change', async () => {
  const backend = fakeBackend({ '/a.md': 'v1' }, { answer: false });
  const app = createApp({ backend });
  await app.open('/a.md');
  backend.fs.set('/a.md', { raw: 'external', mtime: 5 });
  app.update('mine');
  assert.equal(await app.save(), false);
  assert.deepEqual(backend.calls.at(-1), ['ask', OVERWRITE_MESSAGE]);
  assert.equal(backend.fs.get('/a.md').raw, 'external');
});

test('unsaved edits are protected from reload and open', async () => {
  const backend = fakeBackend({ '/a.md': 'v1', '/b.md': 'b' }, { answer: false });
  const app = createApp({ backend });
  await app.open('/a.md');
  app.update('edited');
  backend.fs.set('/a.md', { raw: 'external', mtime: 9 });

  assert.equal(await app.reload(), false, 'auto reload never discards edits');
  await app.open('/b.md');
  assert.equal(app.doc.path, '/a.md', 'declined → stays');
  assert.deepEqual(backend.calls.at(-1), ['ask', DISCARD_MESSAGE]);

  backend.answer = true;
  await app.open('/b.md');
  assert.equal(app.doc.path, '/b.md');
  assert.equal(await app.confirmDiscard(), true, 'nothing to discard');
});

test('isPluginEnabled honours settings and defaults', () => {
  const on = { name: 'on', setup() {} };
  const off = { name: 'off', enabledByDefault: false, setup() {} };
  assert.equal(isPluginEnabled(on), true);
  assert.equal(isPluginEnabled(off), false);
  assert.equal(isPluginEnabled(off, { plugins: { off: true } }), true);
  assert.equal(isPluginEnabled(on, { plugins: { on: false } }), false);
});

test('plugins are set up once, in order', () => {
  const app = createApp({ backend: fakeBackend() });
  const order = [];
  app.use({ name: 'a', setup: () => order.push('a') }).use({ name: 'b', setup: () => order.push('b') });
  assert.deepEqual(order, ['a', 'b']);
  assert.deepEqual(app.plugins(), ['a', 'b']);
  assert.throws(() => app.use({ name: 'a', setup() {} }), /already registered/);
});

test('on() returns an unsubscribe function', () => {
  const app = createApp({ backend: fakeBackend() });
  let n = 0;
  const off = app.on('x', () => n++);
  app.emit('x');
  off();
  app.emit('x');
  assert.equal(n, 1);
});
