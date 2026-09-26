import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../ui/core.js';
import { classifyLink } from '../../ui/plugins/links.js';
import { clampZoom, MIN, MAX } from '../../ui/plugins/zoom.js';
import { checkForChange } from '../../ui/plugins/auto-reload.js';
import { fakeBackend } from './fake-backend.js';

test('classifyLink', () => {
  assert.equal(classifyLink('#intro'), 'anchor');
  assert.equal(classifyLink('https://example.com'), 'web');
  assert.equal(classifyLink('MAILTO:a@b'), 'web');
  assert.equal(classifyLink('other.md'), 'file');
  assert.equal(classifyLink('../docs/a.md#x'), 'file');
  assert.equal(classifyLink('C:\\notes\\a.md'), 'file');
  assert.equal(classifyLink('javascript:alert(1)'), 'ignore');
  assert.equal(classifyLink('file:///c/a.md'), 'ignore');
  assert.equal(classifyLink(''), 'ignore');
});

test('clampZoom', () => {
  assert.equal(clampZoom(1.1000001), 1.1);
  assert.equal(clampZoom(0.1), MIN);
  assert.equal(clampZoom(10), MAX);
});

test('checkForChange reloads only when mtime changes', async () => {
  const backend = fakeBackend({ '/a.md': 'v1' });
  const app = createApp({ backend });
  assert.equal(await checkForChange(app), false, 'no doc open');
  await app.open('/a.md');
  assert.equal(await checkForChange(app), false, 'unchanged');

  backend.fs.set('/a.md', { raw: 'v2', mtime: 2 });
  assert.equal(await checkForChange(app), true);
  assert.equal(app.doc.raw, 'v2');
  assert.equal(await checkForChange(app), false);
});
