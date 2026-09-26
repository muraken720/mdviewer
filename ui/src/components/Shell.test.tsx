import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from '../core/app';
import { fakeBackend } from '../test/fake-backend';
import { Shell } from './Shell';
import view from '../plugins/view';
import editor from '../plugins/editor';
import openFile from '../plugins/open-file';

afterEach(cleanup);

function setup() {
  const app = new App({ backend: fakeBackend({ '/a.md': 'hello' }) });
  app.use(view).use(editor).use(openFile);
  render(<Shell app={app} />);
  return app;
}

test('start screen lists commands with their shortcuts', () => {
  setup();
  expect(screen.getByText('ファイルを開く')).toBeTruthy();
  expect(screen.getByText('表示 / 編集の切替')).toBeTruthy();
});

test('shows the document, and the editor when switching modes', async () => {
  const app = setup();
  await act(() => app.open('/a.md'));
  expect(document.querySelector('.markdown')?.innerHTML).toBe('<p>hello</p>');
  const textarea = document.querySelector('textarea')!;
  expect(textarea.hidden).toBe(true);
  expect(textarea.value).toBe('hello');

  await act(() => app.setMode('edit'));
  expect(textarea.hidden).toBe(false);
  expect(screen.getByRole('button').textContent).toBe('View');
});

test('shows load errors', async () => {
  const app = setup();
  await act(() => app.open('/missing.md'));
  expect(screen.getByText(/not found/)).toBeTruthy();
});
