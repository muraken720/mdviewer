import { expect, test } from 'vitest';
import { App } from '../core/app';
import { fakeBackend } from '../test/fake-backend';
import { checkForChange } from './auto-reload';
import { cursorPosition } from './editor';
import { anchorId, classifyLink } from './links';
import { typeset } from './math';
import theme, { initialTheme, parseTheme } from './theme';
import { windowTitle } from './title';
import { collectHeadings, documentTitle, tocWidth } from './toc';
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

test('parseTheme and initialTheme', () => {
  expect(parseTheme('dark')).toBe('dark');
  expect(parseTheme('auto')).toBeNull(); // value from an earlier build
  expect(parseTheme(null)).toBeNull();
  expect(initialTheme(null, true)).toBe('dark');
  expect(initialTheme(null, false)).toBe('light');
  expect(initialTheme('light', true)).toBe('light');
  expect(initialTheme('dark', false)).toBe('dark');
});

function memory(initial: Record<string, string> = {}) {
  const saved = new Map(Object.entries(initial));
  return {
    saved,
    get: (k: string) => saved.get(k) ?? null,
    set: (k: string, v: string | number) => void saved.set(k, String(v)),
  };
}

test('theme: first launch saves the detected theme; later launches keep the saved one', () => {
  const first = memory();
  new App({ backend: fakeBackend(), storage: first }).use(theme);
  expect(first.saved.get('theme')).toMatch(/^(light|dark)$/); // jsdom has no matchMedia: light

  const storage = memory({ theme: 'dark' });
  const backend = fakeBackend();
  const app = new App({ backend, storage }).use(theme);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(backend.calls).toContainEqual(['setTheme', 'dark']);
  expect(app.getCommand('theme.dark')?.checked?.()).toBe(true);

  app.run('theme.light');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(storage.saved.get('theme')).toBe('light');
  expect(backend.calls).toContainEqual(['setTheme', 'light']);
  expect(app.getCommand('theme.light')?.checked?.()).toBe(true);
  expect(app.getCommand('theme.auto')).toBeUndefined();
});

test('cursorPosition counts lines and columns from 1', () => {
  expect(cursorPosition('', 0)).toEqual({ line: 1, col: 1 });
  expect(cursorPosition('ab\ncd', 2)).toEqual({ line: 1, col: 3 });
  expect(cursorPosition('ab\ncd', 3)).toEqual({ line: 2, col: 1 });
  expect(cursorPosition('ab\n\ncd', 6)).toEqual({ line: 3, col: 3 });
});

test('collectHeadings takes levels 2 and 3 with an id and text', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<h1 id="t">T</h1><h2 id="a">A <code>x</code></h2><h3 id="b">B</h3><h4 id="c">C</h4><h2>no id</h2><h2 id="e"> </h2>';
  expect(collectHeadings(root)).toEqual([
    { id: 'a', text: 'A x', level: 2 },
    { id: 'b', text: 'B', level: 3 },
  ]);
});

test('tocWidth: only when the margin right of the document is wide enough', () => {
  expect(tocWidth(1279, 1)).toBe(0);
  expect(tocWidth(1280, 1)).toBe(182);
  expect(tocWidth(1920, 1)).toBe(260);
  expect(tocWidth(1440, 1.5)).toBe(0); // zoomed in: the document fills the window
});

test('documentTitle is the first level 1 heading, else the fallback', () => {
  const root = document.createElement('div');
  root.innerHTML = '<h2>A</h2><h1> Guide </h1><h1>Other</h1>';
  expect(documentTitle(root, 'a.md')).toBe('Guide');
  root.innerHTML = '<h2>A</h2>';
  expect(documentTitle(root, 'a.md')).toBe('a.md');
});
