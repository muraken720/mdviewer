import { describe, expect, test } from 'vitest';
import { fakeBackend } from '../test/fake-backend';
import { App, isPluginEnabled, keySpec } from './app';
import type { Pane } from './types';

const Dummy: Pane = () => null;
function appWith(files: Record<string, string> = {}, opts?: { answer?: boolean }) {
  const backend = fakeBackend(files, opts);
  const app = new App({ backend, languages: ['ja-JP'] });
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
    expect(keySpec('Alt+ArrowLeft')).toBe('alt+arrowleft');
    expect(keySpec('F5')).toBe('f5');
  });
});

describe('commands', () => {
  test('run via keymap; disabled commands do nothing', () => {
    const { app } = appWith();
    let n = 0;
    let enabled = true;
    app.command({ id: 'x.inc', keys: ['Ctrl+K'], run: () => n++, enabled: () => enabled });
    expect(app.handleKey({ key: 'k', ctrlKey: true })).toBe(true);
    enabled = false;
    app.run('x.inc');
    expect(app.handleKey({ key: 'k' })).toBe(false);
    expect(n).toBe(1);
    expect(() => app.command({ id: 'x.inc', run: () => {} })).toThrow(/already registered/);
    expect(() => app.run('nope')).toThrow(/unknown command/);
  });

  test('menus group registered commands and skip missing ones', () => {
    const { app } = appWith();
    app.addMenu({ id: 'file', label: 'menu.file', mnemonic: 'f', order: 1 });
    app.addMenu({ id: 'empty', label: 'x', mnemonic: 'x', order: 2 });
    app.command({ id: 'a', run() {} });
    app.command({ id: 'b', run() {} });
    app.command({ id: 'c', run() {} });
    app.addMenuItem({ menu: 'file', command: 'c', group: 2 });
    app.addMenuItem({ menu: 'file', command: 'b', group: 1, order: 2 });
    app.addMenuItem({ menu: 'file', command: 'a', group: 1, order: 1 });
    app.addMenuItem({ menu: 'file', command: 'missing', group: 1 });
    const menus = app.menus();
    expect(menus.map((m) => m.def.id)).toEqual(['file']);
    expect(menus[0]?.groups.map((g) => g.map((c) => c.id))).toEqual([['a', 'b'], ['c']]);
  });
});

describe('tabs and documents', () => {
  test('open uses the empty first tab, then new tabs; reopening activates the existing tab', async () => {
    const { app } = appWith({ '/a.md': 'a', '/b.md': 'b' });
    expect(app.tabs).toHaveLength(1);
    await app.open('/a.md');
    expect(app.tabs).toHaveLength(1);
    await app.open('/b.md');
    expect(app.tabs.map((t) => t.doc?.path)).toEqual(['/a.md', '/b.md']);
    expect(app.doc?.path).toBe('/b.md');
    await app.open('/a.md');
    expect(app.tabs).toHaveLength(2);
    expect(app.doc?.path).toBe('/a.md');
  });

  test('open errors are reported as translated toasts', async () => {
    const { app } = appWith();
    const toasts: string[] = [];
    app.on('toast', (m) => toasts.push(m));
    await app.open('/missing.md');
    expect(toasts).toEqual(['読み書きできませんでした: not found: /missing.md']);
    expect(app.tabs).toHaveLength(1);
  });

  test('cycleTab wraps; closeTab keeps at least one (empty) tab and frees the document', async () => {
    const { app, backend } = appWith({ '/a.md': 'a', '/b.md': 'b', '/c.md': 'c' });
    await app.open('/a.md');
    await app.open('/b.md');
    await app.open('/c.md');
    app.cycleTab(1);
    expect(app.doc?.path).toBe('/a.md');
    app.cycleTab(-1);
    expect(app.doc?.path).toBe('/c.md');
    await app.closeTab();
    expect(app.doc?.path).toBe('/b.md');
    await app.closeTab();
    await app.closeTab();
    expect(app.tabs).toHaveLength(1);
    expect(app.doc).toBeNull();
    expect(backend.docs.size).toBe(0);
  });

  test('closing a tab with unsaved edits asks first', async () => {
    const { app, backend } = appWith({ '/a.md': 'a' }, { answer: false });
    await app.open('/a.md');
    app.update('edited');
    expect(await app.closeTab()).toBe(false);
    expect(app.doc?.path).toBe('/a.md');
    expect(backend.calls.at(-1)).toEqual(['ask', app.t('confirm.discard')]);
  });

  test('confirmExit asks only when some tab is dirty', async () => {
    const { app, backend } = appWith({ '/a.md': 'a', '/b.md': 'b' }, { answer: false });
    await app.open('/a.md');
    await app.open('/b.md');
    expect(await app.confirmExit()).toBe(true);
    app.activate(app.tabs[0]?.id ?? 0);
    app.update('edited');
    app.activate(app.tabs[1]?.id ?? 0);
    expect(await app.confirmExit()).toBe(false);
    expect(backend.calls.at(-1)).toEqual(['ask', app.t('confirm.exit')]);
  });
});

describe('history', () => {
  test('links open in the same tab; back and forward restore pages and scroll positions', async () => {
    const { app, backend } = appWith({ '/d/a.md': 'a', '/d/b.md': 'b', '/d/c.md': 'c' });
    await app.open('/d/a.md');
    const tab = app.active;
    tab.scroll = 120;
    await app.openLink('b.md');
    expect(app.tabs).toHaveLength(1);
    expect(app.doc?.path).toBe('/d/b.md');
    expect(tab.scroll).toBe(0);
    expect(app.canGoBack()).toBe(true);
    expect(app.canGoForward()).toBe(false);

    tab.scroll = 40;
    await app.back();
    expect(app.doc?.path).toBe('/d/a.md');
    expect(tab.scroll).toBe(120);
    expect(app.canGoForward()).toBe(true);

    await app.forward();
    expect(app.doc?.path).toBe('/d/b.md');
    expect(tab.scroll).toBe(40);

    // A new link clears the forward history.
    await app.back();
    await app.openLink('c.md');
    expect(app.canGoForward()).toBe(false);
    expect(tab.back.map((e) => e.path)).toEqual(['/d/a.md']);
    // Only the shown document stays open on the host side.
    expect([...backend.docs.values()]).toEqual(['/d/c.md']);
  });

  test('refused links leave the page as it is', async () => {
    const { app } = appWith({ '/d/a.md': 'a' });
    const toasts: string[] = [];
    app.on('toast', (m) => toasts.push(m));
    await app.open('/d/a.md');
    await app.openLink('missing.md');
    expect(app.doc?.path).toBe('/d/a.md');
    expect(app.canGoBack()).toBe(false);
    expect(toasts).toHaveLength(1);
  });

  test('navigating away from unsaved edits asks first', async () => {
    const { app } = appWith({ '/d/a.md': 'a', '/d/b.md': 'b' }, { answer: false });
    await app.open('/d/a.md');
    app.update('edited');
    await app.openLink('b.md');
    expect(app.doc?.path).toBe('/d/a.md');
  });
});

describe('editing', () => {
  test('mode changes need a pane and a document, and are per tab', async () => {
    const { app } = appWith({ '/a.md': 'a', '/b.md': 'b' });
    await app.setMode('edit');
    expect(app.mode).toBe('view');
    await app.open('/a.md');
    await app.setMode('edit');
    await app.open('/b.md');
    expect(app.mode).toBe('view');
    app.cycleTab(1);
    expect(app.mode).toBe('edit');
  });

  test('editing marks the tab dirty; switching to view re-renders once', async () => {
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

  test('save writes the tab document and keeps mtime in sync', async () => {
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
    expect(backend.calls.at(-1)).toEqual(['ask', app.t('confirm.overwrite')]);
    expect(backend.fs.get('/a.md')?.raw).toBe('external');
  });

  test('a failed save is reported as a toast', async () => {
    const { app, backend } = appWith({ '/a.md': 'v1' });
    backend.save = async () => {
      throw { code: 'io', detail: 'disk full' };
    };
    const toasts: string[] = [];
    app.on('toast', (m) => toasts.push(m));
    await app.open('/a.md');
    app.update('v2');
    expect(await app.save()).toBe(false);
    expect(app.dirty).toBe(true);
    expect(toasts[0]).toContain('disk full');
  });

  test('reload never discards unsaved edits unless forced', async () => {
    const { app, backend } = appWith({ '/a.md': 'v1' });
    await app.open('/a.md');
    app.update('edited');
    backend.fs.set('/a.md', { raw: 'external', mtime: 9 });
    expect(await app.reload()).toBe(false);
    expect(await app.reload({ force: true })).toBe(true);
    expect(app.doc?.raw).toBe('external');
  });
});

describe('i18n', () => {
  test('follows the OS language, can be changed and is remembered', () => {
    const { app } = appWith();
    expect(app.t('menu.file')).toBe('ファイル');
    let changed = 0;
    app.on('lang:changed', () => changed++);
    app.setLanguage('en');
    expect(app.t('menu.file')).toBe('File');
    expect(app.storage.get('lang')).toBe('en');
    expect(changed).toBe(1);

    const again = new App({ backend: fakeBackend(), storage: app.storage, languages: ['ja'] });
    expect(again.i18n.setting).toBe('en');
  });

  test('formatError translates host error codes', () => {
    const { app } = appWith();
    expect(app.formatError({ code: 'not-document', detail: 'x.exe' })).toBe('Markdown ファイルではありません: x.exe');
    expect(app.formatError(new Error('boom'))).toBe('boom');
  });
});

test('plugins are set up once, in order; contributions are collected', () => {
  const { app } = appWith();
  const order: string[] = [];
  const Overlay = () => null;
  const Bar = () => null;
  app.use({ name: 'a', setup: () => order.push('a') }).use({
    name: 'b',
    setup: (a) => {
      order.push('b');
      a.addOverlay(Overlay);
      a.addBar(Bar);
    },
  });
  expect(order).toEqual(['a', 'b']);
  expect(app.plugins()).toEqual(['a', 'b']);
  expect(app.overlays()).toEqual([Overlay]);
  expect(app.bars()).toEqual([Bar]);
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
