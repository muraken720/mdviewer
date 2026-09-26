// mdviewer UI core: state, event bus, commands/keymap and plugin host.
// No DOM or Tauri access here, so it can be tested with `node --test`.

/**
 * @typedef {{ path: string, name: string, raw: string, html: string, mtime: number }} Doc
 *
 * @typedef {object} Backend  Host services (see backend.js for the Tauri implementation).
 * @property {(path: string, base?: string|null) => Promise<Doc>} load
 * @property {(path: string) => Promise<number>} mtime
 * @property {() => Promise<string|null>} pickFile
 * @property {(url: string) => Promise<void>} openUrl
 * @property {() => Promise<string|null>} initialPath
 * @property {(cb: (paths: string[]) => void) => void} onDrop
 *
 * @typedef {object} Plugin
 * @property {string} name
 * @property {(app: App) => void} setup
 */

/** Normalise a key binding ("Ctrl+Shift+E") or a KeyboardEvent to "ctrl+shift+e". */
export function keySpec(e) {
  if (typeof e === 'string') {
    const parts = e.toLowerCase().split('+');
    const key = parts.pop() || '+';           // "Ctrl++" → key "+"
    return keySpec({
      key,
      ctrlKey: parts.includes('ctrl'),
      altKey: parts.includes('alt'),
      shiftKey: parts.includes('shift'),
    });
  }
  const key = e.key.toLowerCase();
  // For symbols the key already reflects Shift ("+" vs "="), so Shift is ignored for them.
  const shiftMatters = key.length > 1 || /[a-z0-9]/.test(key);
  return (e.ctrlKey || e.metaKey ? 'ctrl+' : '') +
    (e.altKey ? 'alt+' : '') +
    (e.shiftKey && shiftMatters ? 'shift+' : '') +
    key;
}

/** In-memory Storage, used when none is supplied (tests, blocked localStorage). */
export function memoryStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, String(v)) };
}

/**
 * @param {{ backend: Backend, storage?: { get(k: string): string|null, set(k: string, v: any): void } }} opts
 */
export function createApp({ backend, storage = memoryStorage() }) {
  const listeners = new Map();
  const commands = new Map();
  const keymap = new Map();
  const plugins = [];

  const app = {
    backend,
    storage,
    /** @type {Doc|null} */
    doc: null,
    /** @type {'view'|'raw'} */
    mode: 'view',

    // ---- events ----
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return () => listeners.set(event, listeners.get(event).filter((f) => f !== fn));
    },
    emit(event, ...args) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },

    // ---- commands & keys ----
    command(id, run, keys = []) {
      if (commands.has(id)) throw new Error(`command already registered: ${id}`);
      commands.set(id, run);
      for (const k of keys) keymap.set(keySpec(k), id);
    },
    run(id, ...args) {
      const cmd = commands.get(id);
      if (!cmd) throw new Error(`unknown command: ${id}`);
      return cmd(...args);
    },
    /** Returns true if the key was handled (caller should preventDefault). */
    handleKey(e) {
      const id = keymap.get(keySpec(e));
      if (!id) return false;
      app.run(id);
      return true;
    },
    keys() {
      return [...keymap].map(([key, id]) => ({ key, id }));
    },

    // ---- documents ----
    async open(path, base = null) {
      try {
        app.doc = await backend.load(path, base);
        app.emit('doc:loaded', app.doc, { reset: true });
      } catch (err) {
        app.emit('doc:error', err);
      }
    },
    async reload() {
      if (!app.doc) return;
      try {
        app.doc = await backend.load(app.doc.path);
        app.emit('doc:loaded', app.doc, { reset: false });
      } catch { /* file may be mid-write; the next change will retry */ }
    },
    setMode(mode) {
      if (mode === app.mode) return;
      app.mode = mode;
      app.emit('mode:changed', mode);
    },

    // ---- plugins ----
    /** @param {Plugin} plugin */
    use(plugin) {
      if (plugins.some((p) => p.name === plugin.name)) throw new Error(`plugin already registered: ${plugin.name}`);
      plugins.push(plugin);
      plugin.setup(app);
      return app;
    },
    plugins: () => plugins.map((p) => p.name),
    start() {
      app.emit('app:start');
    },
  };
  return app;
}
