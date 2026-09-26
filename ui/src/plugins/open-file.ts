// Ways to open a file: command-line argument, Ctrl+O dialog, drag & drop. Plus manual reload.
import type { Plugin } from '../core/types';

const openFile: Plugin = {
  name: 'open-file',
  setup(app) {
    app.command({
      id: 'file.open',
      title: 'ファイルを開く',
      keys: ['Ctrl+O'],
      run: async () => {
        const path = await app.backend.pickFile();
        if (path) await app.open(path);
      },
    });
    app.command({
      id: 'file.reload',
      title: '再読み込み（ファイルの変更は自動で反映）',
      keys: ['F5', 'Ctrl+R'],
      run: async () => {
        if (await app.confirmDiscard()) await app.reload({ force: true });
      },
    });
    app.backend.onDrop((paths) => {
      if (paths[0]) void app.open(paths[0]);
    });
    app.on('app:start', async () => {
      const path = await app.backend.initialPath();
      if (path) await app.open(path);
    });
  },
};
export default openFile;
