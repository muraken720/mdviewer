// Ways to open a file: command line, Ctrl+O dialog, drag & drop, a second launch. Plus reload.
import type { Plugin } from '../core/types';

const openFile: Plugin = {
  name: 'open-file',
  setup(app) {
    app.command({
      id: 'file.open',
      title: 'cmd.file.open',
      keys: ['Ctrl+O'],
      run: async () => {
        const path = await app.backend.pickFile();
        if (path) await app.open(path);
      },
    });
    app.command({
      id: 'file.reload',
      title: 'cmd.file.reload',
      keys: ['F5', 'Ctrl+R'],
      run: async () => {
        if (await app.confirmDiscard()) await app.reload({ force: true });
      },
      enabled: () => !!app.doc,
    });
    app.addMenuItem({ menu: 'file', command: 'file.open', group: 10 });
    app.addMenuItem({ menu: 'file', command: 'file.reload', group: 20, order: 2 });

    app.backend.onOpenRequest((path) => void app.open(path));
    app.on('app:start', async () => {
      const path = await app.backend.initialPath();
      if (path) await app.open(path);
    });
  },
};
export default openFile;
