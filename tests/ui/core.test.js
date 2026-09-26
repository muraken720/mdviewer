import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, keySpec } from '../../ui/core.js';
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

test('mode changes are emitted once', () => {
  const app = createApp({ backend: fakeBackend() });
  const modes = [];
  app.on('mode:changed', (m) => modes.push(m));
  app.setMode('raw');
  app.setMode('raw');
  app.setMode('view');
  assert.deepEqual(modes, ['raw', 'view']);
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
