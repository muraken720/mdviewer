// Tauri implementation of the Backend interface (see core.js).
export function tauriBackend() {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  return {
    load: (path, base = null) => invoke('load', { path, base }),
    mtime: (path) => invoke('mtime', { path }),
    pickFile: () => invoke('pick_file'),
    openUrl: (url) => invoke('open_url', { url }),
    initialPath: () => invoke('initial_path'),
    onDrop: (cb) => listen('tauri://drag-drop', (e) => cb(e.payload.paths ?? [])),
  };
}

export function browserStorage() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
}
