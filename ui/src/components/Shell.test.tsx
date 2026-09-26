import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../core/app';
import editor from '../plugins/editor';
import help from '../plugins/help';
import language from '../plugins/language';
import menu from '../plugins/menu';
import openFile from '../plugins/open-file';
import tabs from '../plugins/tabs';
import view from '../plugins/view';
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
