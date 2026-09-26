// Color theme: light or dark, chosen from the View menu and remembered.
// On the first launch (nothing saved yet) the OS setting decides, and that choice is saved.
// The theme is set as <html data-theme="light|dark">; app.css picks colors from it.

import type { Plugin } from '../core/types';

export type Theme = 'light' | 'dark';

const OPTIONS: Theme[] = ['light', 'dark'];

/** The saved theme, or null if none was saved yet (or the value is unknown). */
export function parseTheme(value: unknown): Theme | null {
  return OPTIONS.includes(value as Theme) ? (value as Theme) : null;
}

/** The theme to use: the saved one, else the OS setting. */
export function initialTheme(saved: unknown, systemDark: boolean): Theme {
  return parseTheme(saved) ?? (systemDark ? 'dark' : 'light');
}

/** The theme in effect (also used by plugins that draw their own colors, such as Mermaid). */
export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const theme: Plugin = {
  name: 'theme',
  setup(app) {
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    let current = initialTheme(app.storage.get('theme'), systemDark);

    const apply = () => {
      app.storage.set('theme', current);
      // The window frame (title bar) follows too.
      void app.backend.setTheme(current).catch(() => {});
      if (document.documentElement.dataset.theme === current) return;
      document.documentElement.dataset.theme = current;
      app.emit('plugin:theme', current);
    };
    apply();

    OPTIONS.forEach((option, i) => {
      app.command({
        id: `theme.${option}`,
        title: `cmd.theme.${option}`,
        run: () => {
          current = option;
          apply();
        },
        checked: () => current === option,
      });
      app.addMenuItem({ menu: 'view', command: `theme.${option}`, group: 80, order: i });
    });
  },
};
export default theme;
