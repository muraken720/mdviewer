import { expect, test } from 'vitest';
import { App } from '../core/app';
import { fakeBackend } from '../test/fake-backend';
import { checkForChange } from './auto-reload';
import { anchorId, classifyLink } from './links';
import { typeset } from './math';
import { windowTitle } from './title';
import { clampZoom, MAX, MIN } from './zoom';

test('classifyLink', () => {
  expect(classifyLink('#intro')).toBe('anchor');
  expect(classifyLink('https://example.com')).toBe('web');
  expect(classifyLink('MAILTO:a@b')).toBe('web');
  expect(classifyLink('other.md')).toBe('file');
  expect(classifyLink('../docs/a.md#x')).toBe('file');
  expect(classifyLink('C:\\notes\\a.md')).toBe('ignore');
  expect(classifyLink('//evil/share/a.md')).toBe('ignore');
  expect(classifyLink('\\\\evil\\share\\a.md')).toBe('ignore');
  expect(classifyLink('/etc/a.md')).toBe('ignore');
  expect(classifyLink('javascript:alert(1)')).toBe('ignore');
  expect(classifyLink('file:///c/a.md')).toBe('ignore');
  expect(classifyLink('')).toBe('ignore');
});

test('anchorId decodes, and tolerates malformed input', () => {
  expect(anchorId('#%E6%A6%82%E8%A6%81')).toBe('概要');
  expect(anchorId('#100%')).toBe('100%');
});

test('clampZoom', () => {
  expect(clampZoom(1.1000001)).toBe(1.1);
  expect(clampZoom(0.1)).toBe(MIN);
  expect(clampZoom(10)).toBe(MAX);
});

test('checkForChange reloads only on change and never over unsaved edits', async () => {
  const backend = fakeBackend({ '/a.md': 'v1' });
  const app = new App({ backend });
  expect(await checkForChange(app)).toBe(false);
  await app.open('/a.md');
  expect(await checkForChange(app)).toBe(false);

  backend.fs.set('/a.md', { raw: 'v2', mtime: 2 });
  expect(await checkForChange(app)).toBe(true);
  expect(app.doc?.raw).toBe('v2');

  app.update('unsaved');
  backend.fs.set('/a.md', { raw: 'v3', mtime: 3 });
  expect(await checkForChange(app)).toBe(false);
  expect(app.doc?.raw).toBe('unsaved');
});

test('windowTitle', () => {
  expect(windowTitle(null, false)).toBe('mdviewer');
  expect(windowTitle({ name: 'a.md' }, false)).toBe('a.md - mdviewer');
  expect(windowTitle({ name: 'a.md' }, true)).toBe('● a.md - mdviewer');
});

test('typeset renders inline, display and ```math blocks with KaTeX', async () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<p><span class="math math-inline">x^2</span></p>' +
    '<p><span class="math math-display">\\frac{a}{b}</span></p>' +
    '<pre><code class="language-math">E=mc^2</code></pre>' +
    '<p><span class="math math-inline">\\badcommand</span></p>';
  await typeset(root);
  expect(root.querySelectorAll('.katex')).toHaveLength(4);
  expect(root.querySelectorAll('.katex-display')).toHaveLength(2);
  expect(root.querySelector('pre')).toBeNull();
  expect(root.textContent).toContain('\\badcommand'); // unknown commands are shown (in red), not thrown
});
