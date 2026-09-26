// Ways to open a file: command-line argument, Ctrl+O dialog, drag & drop. Plus manual reload.
export default {
  name: 'open-file',
  setup(app) {
    app.command('file.open', async () => {
      const p = await app.backend.pickFile();
      if (p) await app.open(p);
    }, ['Ctrl+O']);

    app.command('file.reload', async () => {
      if (await app.confirmDiscard()) await app.reload({ force: true });
    }, ['F5', 'Ctrl+R']);

    app.backend.onDrop((paths) => {
      if (paths[0]) app.open(paths[0]);
    });

    app.on('app:start', async () => {
      const p = await app.backend.initialPath();
      if (p) await app.open(p);
    });
  },
};
