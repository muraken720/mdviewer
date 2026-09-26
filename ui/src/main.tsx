import { createRoot } from 'react-dom/client';
import { browserStorage, tauriBackend } from './backend/tauri';
import { Shell } from './components/Shell';
import { App, isPluginEnabled } from './core/app';
import plugins from './plugins';
import './styles/app.css';

const backend = tauriBackend();
const settings = await backend.settings().catch(() => ({}));
const app = new App({ backend, storage: browserStorage(), settings });
for (const plugin of plugins) {
  if (isPluginEnabled(plugin, settings)) app.use(plugin);
}

window.addEventListener('keydown', (e) => {
  if (!e.defaultPrevented && app.handleKey(e)) e.preventDefault();
});

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');
createRoot(root).render(<Shell app={app} />);
app.start();
