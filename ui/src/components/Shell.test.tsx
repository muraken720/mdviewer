import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../core/app';
import editor from '../plugins/editor';
import help from '../plugins/help';
import language from '../plugins/language';
import menu from '../plugins/menu';
import openFile from '../plugins/open-file';
import tabs from '../plugins/tabs';
import toc from '../plugins/toc';
import view from '../plugins/view';
import zoom from '../plugins/zoom';
import { fakeBackend } from '../test/fake-backend';
import { Shell } from './Shell';

afterEach(cleanup);

function setup() {
  const app = new App({ backend: fakeBackend({ '/d/a.md': 'hello', '/d/b.md': 'bee' }), languages: ['ja-JP'] });
  for (const p of [menu, tabs, view, editor, openFile, language, help]) app.use(p);
  render(<Shell app={app} />);
  return app;
}

test('start screen lists the main shortcuts', () => {
  setup();
  expect(screen.getByText('ファイルを開く…')).toBeTruthy();
  expect(screen.getByText('表示 / 編集の切替')).toBeTruthy();
});

test('menu bar opens menus and runs commands; disabled items are greyed out', async () => {
  const app = setup();
  const bar = screen.getByRole('menubar');
  expect(within(bar).getByText(/ファイル/)).toBeTruthy();
  fireEvent.click(within(bar).getByText(/移動/));
  const back = screen.getByRole('menuitem', { name: /戻る/ });
  expect((back as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(within(bar).getByText(/表示\(V\)/));
  const english = screen.getByRole('menuitemcheckbox', { name: /English/ });
  await act(async () => fireEvent.click(english));
  expect(app.i18n.lang).toBe('en');
  expect(within(bar).getByText('ile')).toBeTruthy(); // "File" with the F underlined
});

test('documents open in tabs; the editor is per tab', async () => {
  const app = setup();
  await act(() => app.open('/d/a.md'));
  await act(() => app.open('/d/b.md'));
  const tabsEls = screen.getAllByRole('tab');
  expect(tabsEls.map((t) => t.textContent)).toEqual(['a.md', 'b.md']);
  expect(tabsEls[1]?.getAttribute('aria-selected')).toBe('true');

  await act(() => app.setMode('edit'));
  const editors = document.querySelectorAll<HTMLTextAreaElement>('textarea');
  expect([...editors].map((e) => e.value)).toEqual(['hello', 'bee']);
  expect(editors[1]?.hidden).toBe(false);

  await act(async () => fireEvent.click(tabsEls[0] as HTMLElement));
  expect(app.doc?.path).toBe('/d/a.md');
  expect(document.querySelector('[data-viewer] article')?.innerHTML).toBe('<p>hello</p>');
});

test('help dialog lists shortcuts and closes with Escape', async () => {
  const app = setup();
  await act(async () => app.run('help.shortcuts'));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('キーボードショートカット', { selector: 'td' })).toBeTruthy();
  await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the view / edit switch shows the current mode and switches it', async () => {
  const app = setup();
  await act(() => app.open('/d/a.md'));
  const group = screen.getByRole('group', { name: '表示 / 編集の切替' });
  const viewButton = within(group).getByRole('button', { name: '表示' });
  const editButton = within(group).getByRole('button', { name: '編集' });
  expect(viewButton.getAttribute('aria-pressed')).toBe('true');
  expect(editButton.getAttribute('aria-pressed')).toBe('false');

  await act(async () => fireEvent.click(editButton));
  expect(app.mode).toBe('edit');
  expect(editButton.getAttribute('aria-pressed')).toBe('true');

  await act(async () => fireEvent.click(viewButton));
  expect(app.mode).toBe('view');
});

test('the status bar shows the zoom level and the switch; edited tabs are marked', async () => {
  const app = new App({ backend: fakeBackend({ '/d/a.md': 'hello' }), languages: ['ja-JP'] });
  for (const p of [menu, tabs, view, editor, zoom]) app.use(p);
  render(<Shell app={app} />);
  await act(() => app.open('/d/a.md'));
  const status = screen.getByRole('contentinfo');
  const zoomButton = within(status).getByRole('button', { name: '100%' });
  within(status).getByRole('group', { name: '表示 / 編集の切替' });

  await act(async () => app.run('zoom.in'));
  expect(zoomButton.textContent).toBe('110%');
  await act(async () => fireEvent.click(zoomButton));
  expect(zoomButton.textContent).toBe('100%');

  await act(async () => app.setMode('edit'));
  expect(screen.getByRole('tab', { name: /a\.md.*\(編集\)/ })).toBeTruthy();
});

test('the status bar shows the cursor line and column while editing', async () => {
  const app = new App({ backend: fakeBackend({ '/d/a.md': 'one\ntwo' }), languages: ['ja-JP'] });
  for (const p of [menu, tabs, view, editor]) app.use(p);
  render(<Shell app={app} />);
  await act(() => app.open('/d/a.md'));
  const status = screen.getByRole('contentinfo');
  expect(within(status).queryByText(/^行/)).toBeNull();

  await act(async () => app.setMode('edit'));
  const ta = document.querySelector('textarea') as HTMLTextAreaElement;
  ta.setSelectionRange(6, 6);
  await act(async () => fireEvent.select(ta));
  expect(within(status).getByText('行 2, 列 3')).toBeTruthy();
});

test('wide windows show a table of contents in view mode; the View menu turns it off', async () => {
  const doc = '<h2 id="intro">Intro</h2><h3 id="setup">Setup</h3><h2 id="usage">Usage</h2>';
  const app = new App({ backend: fakeBackend({ '/d/a.md': doc, '/d/b.md': 'short' }), languages: ['ja-JP'] });
  for (const p of [menu, tabs, view, editor, toc]) app.use(p);
  const width = window.innerWidth;
  window.innerWidth = 1440;
  try {
    render(<Shell app={app} />);
    await act(() => app.open('/d/a.md'));
    const nav = screen.getByRole('navigation', { name: '目次' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Intro', 'Setup', 'Usage']);

    await act(async () => app.setMode('edit'));
    expect(screen.queryByRole('navigation', { name: '目次' })).toBeNull();
    await act(async () => app.setMode('view'));
    expect(screen.getByRole('navigation', { name: '目次' })).toBeTruthy();

    await act(async () => app.run('view.toc'));
    expect(screen.queryByRole('navigation', { name: '目次' })).toBeNull();
    await act(async () => app.run('view.toc'));

    await act(() => app.open('/d/b.md')); // too few headings
    expect(screen.queryByRole('navigation', { name: '目次' })).toBeNull();
  } finally {
    window.innerWidth = width;
  }
});
