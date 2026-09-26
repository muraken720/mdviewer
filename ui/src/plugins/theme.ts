// Color theme: automatic (follows the OS), light or dark. The choice is remembered.
// The resolved theme is set as <html data-theme="light|dark">; app.css picks colors from it.

import type { Plugin } from '../core/types';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const OPTIONS: ThemeSetting[] = ['auto', 'light', 'dark'];

export function parseTheme(value: unknown): ThemeSetting {
  return OPTIONS.includes(value as ThemeSetting) ? (value as ThemeSetting) : 'auto';
}

export function resolveTheme(setting: ThemeSetting, systemDark: boolean): Theme {
  if (setting === 'auto') return systemDark ? 'dark' : 'light';
  return setting;
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
    let setting = parseTheme(app.storage.get('theme'));
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = resolveTheme(setting, media?.matches ?? false);
      if (document.documentElement.dataset.theme === resolved) return;
      document.documentElement.dataset.theme = resolved;
      app.emit('plugin:theme', resolved);
    };
    const set = (next: ThemeSetting) => {
      setting = next;
      app.storage.set('theme', next);
      // The window frame (title bar) follows too; `null` hands it back to the OS.
      void app.backend.setTheme(next === 'auto' ? null : next).catch(() => {});
      apply();
      app.emit('plugin:theme-setting', next);
    };

    void app.backend.setTheme(setting === 'auto' ? null : setting).catch(() => {});
    apply();
    media?.addEventListener?.('change', apply);

    OPTIONS.forEach((option, i) => {
      app.command({
        id: `theme.${option}`,
        title: `cmd.theme.${option}`,
        run: () => set(option),
        checked: () => setting === option,
      });
      app.addMenuItem({ menu: 'view', command: `theme.${option}`, group: 80, order: i });
    });
  },
};
export default theme;
