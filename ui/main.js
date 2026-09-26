import { createApp, isPluginEnabled } from './core.js';
import { tauriBackend, browserStorage } from './backend.js';
import plugins from './plugins/index.js';

const backend = tauriBackend();
const settings = await backend.settings().catch(() => ({}));
const app = createApp({ backend, storage: browserStorage(), settings });
for (const p of plugins) {
  if (isPluginEnabled(p, settings)) app.use(p);
}

window.addEventListener('keydown', (e) => {
  if (!e.defaultPrevented && app.handleKey(e)) e.preventDefault();
});

app.start();
