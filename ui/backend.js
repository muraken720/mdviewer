// Tauri implementation of the Backend interface (see core.js).
export function tauriBackend() {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  const win = window.__TAURI__.window.getCurrentWindow();
  return {
    settings: () => invoke('settings'),
    load: (path, base = null) => invoke('load', { path, base }),
    render: (text, path) => invoke('render', { text, path }),
    save: (path, text) => invoke('save', { path, text }),
    mtime: (path) => invoke('mtime', { path }),
    pickFile: () => invoke('pick_file'),
    ask: (message) => invoke('ask', { message }),
    openUrl: (url) => invoke('open_url', { url }),
    initialPath: () => invoke('initial_path'),
    setTitle: (title) => win.setTitle(title),
    onDrop: (cb) => listen('tauri://drag-drop', (e) => cb(e.payload.paths ?? [])),
    onCloseRequested: (cb) => win.onCloseRequested(async (e) => {
      if (!(await cb())) e.preventDefault();
    }),
  };
}

export function browserStorage() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
}
