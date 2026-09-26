// The menu bar and the top-level menus. Other plugins add their commands with `app.addMenuItem`.
import { MenuBar } from '../components/MenuBar';
import type { MenuDef, Plugin } from '../core/types';

export const MENUS: MenuDef[] = [
  { id: 'file', label: 'menu.file', mnemonic: 'f', order: 1 },
  { id: 'edit', label: 'menu.edit', mnemonic: 'e', order: 2 },
  { id: 'view', label: 'menu.view', mnemonic: 'v', order: 3 },
  { id: 'go', label: 'menu.go', mnemonic: 'g', order: 4 },
  { id: 'help', label: 'menu.help', mnemonic: 'h', order: 5 },
];

const menu: Plugin = {
  name: 'menu',
  setup(app) {
    for (const def of MENUS) {
      app.addMenu(def);
      // Alt+F, Alt+E, … open the menus (no title: not listed as shortcuts).
      app.command({
        id: `menu.open.${def.id}`,
        keys: [`Alt+${def.mnemonic.toUpperCase()}`],
        run: () => app.emit('plugin:menu-open', def.id),
      });
    }
    app.command({ id: 'menu.focus', keys: ['F10'], run: () => app.emit('plugin:menu-focus') });
    app.addBar(MenuBar);

    // Closing goes through the window's close request, which asks about unsaved tabs.
    app.command({ id: 'app.exit', title: 'cmd.app.exit', run: () => app.backend.closeWindow() });
    app.addMenuItem({ menu: 'file', command: 'app.exit', group: 90 });
  },
};
export default menu;
