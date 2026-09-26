import { createApp } from './core.js';
import { tauriBackend, browserStorage } from './backend.js';
import plugins from './plugins/index.js';

const app = createApp({ backend: tauriBackend(), storage: browserStorage() });
for (const p of plugins) app.use(p);

window.addEventListener('keydown', (e) => {
  if (app.handleKey(e)) e.preventDefault();
});

app.start();
