// mdviewer UI core: document state, event bus, commands/keymap and plugin host.
// No DOM or Tauri access here, so it can be tested with `node --test`.

/**
 * @typedef {{ path: string, name: string, raw: string, html: string, mtime: number }} Doc
 *   `raw` is the current (possibly edited) text; `html` is the last render of it.
 *
 * @typedef {object} Backend  Host services (see backend.js for the Tauri implementation).
 * @property {(path: string, base?: string|null) => Promise<Doc>} load
 * @property {(text: string, path: string) => Promise<string>} render
 * @property {(path: string, text: string) => Promise<number>} save   Returns the new mtime.
 * @property {(path: string) => Promise<number>} mtime
 * @property {() => Promise<string|null>} pickFile
 * @property {(message: string) => Promise<boolean>} ask
 * @property {(url: string) => Promise<void>} openUrl
 * @property {() => Promise<string|null>} initialPath
 * @property {(title: string) => Promise<void>} setTitle
 * @property {(cb: (paths: string[]) => void) => void} onDrop
 * @property {(cb: () => Promise<boolean>) => void} onCloseRequested  cb returns false to cancel.
 *
 * @typedef {{ plugins?: Record<string, boolean> }} Settings
 *
 * @typedef {object} Plugin
 * @property {string} name
 * @property {boolean} [enabledByDefault]  Defaults to true.
 * @property {(app: App) => void} setup
 */

export const DISCARD_MESSAGE = '未保存の変更があります。破棄してよろしいですか？';
export const OVERWRITE_MESSAGE = 'ファイルが外部で変更されています。上書き保存してよろしいですか？';

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

/** Whether a plugin should be loaded, given the user's settings. */
export function isPluginEnabled(plugin, settings = {}) {
  return settings.plugins?.[plugin.name] ?? plugin.enabledByDefault !== false;
}

/** In-memory Storage, used when none is supplied (tests, blocked localStorage). */
export function memoryStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, String(v)) };
}

/**
 * @param {{ backend: Backend, storage?: { get(k: string): string|null, set(k: string, v: any): void }, settings?: Settings }} opts
 */
export function createApp({ backend, storage = memoryStorage(), settings = {} }) {
  const listeners = new Map();
  const commands = new Map();
  const keymap = new Map();
  const plugins = [];
  let savedText = '';     // text as it is on disk
  let renderedText = '';  // text that doc.html was rendered from

  const loaded = (doc, reset) => {
    app.doc = doc;
    savedText = renderedText = doc.raw;
    app.emit('doc:loaded', doc, { reset });
    app.emit('doc:dirty', false);
  };

  const app = {
    backend,
    storage,
    settings,
    /** @type {Doc|null} */
    doc: null,
    /** @type {'view'|'edit'} */
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
    /** True if the text differs from the file on disk. */
    get dirty() {
      return !!app.doc && app.doc.raw !== savedText;
    },
    /** Ask before throwing away unsaved edits. Resolves true if it is OK to proceed. */
    async confirmDiscard() {
      return !app.dirty || backend.ask(DISCARD_MESSAGE);
    },
    async open(path, base = null) {
      if (!(await app.confirmDiscard())) return;
      try {
        loaded(await backend.load(path, base), true);
      } catch (err) {
        app.emit('doc:error', err);
      }
    },
    /** Re-read the file. Unsaved edits are kept unless `force` is set (manual reload asks first). */
    async reload({ force = false } = {}) {
      if (!app.doc || (app.dirty && !force)) return false;
      try {
        loaded(await backend.load(app.doc.path), false);
        return true;
      } catch {
        return false; // file may be mid-write; the next change will retry
      }
    },
    /** Replace the current text (called by the editor on every change). */
    update(text) {
      if (!app.doc || text === app.doc.raw) return;
      const was = app.dirty;
      app.doc.raw = text;
      if (was !== app.dirty) app.emit('doc:dirty', app.dirty);
    },
    /** Re-render the current text if it changed since the last render. */
    async refresh() {
      if (!app.doc || app.doc.raw === renderedText) return;
      const text = app.doc.raw;
      app.doc.html = await backend.render(text, app.doc.path);
      renderedText = text;
      app.emit('doc:rendered', app.doc);
    },
    async save() {
      if (!app.doc) return false;
      const doc = app.doc;
      const onDisk = await backend.mtime(doc.path);
      if (onDisk && onDisk !== doc.mtime && !(await backend.ask(OVERWRITE_MESSAGE))) return false;
      const text = doc.raw;
      try {
        doc.mtime = await backend.save(doc.path, text);
      } catch (err) {
        app.emit('doc:error', err, { keepView: true });
        return false;
      }
      savedText = text;
      app.emit('doc:saved', doc);
      app.emit('doc:dirty', app.dirty);
      if (app.mode === 'view') await app.refresh();
      return true;
    },
    async setMode(mode) {
      if (mode === app.mode) return;
      app.mode = mode;
      if (mode === 'view') await app.refresh();
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
