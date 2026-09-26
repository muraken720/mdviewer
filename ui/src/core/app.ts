// mdviewer UI core: document state, events, commands/keymap and the plugin host.
// No DOM, React or Tauri access here, so it is unit-tested directly (app.test.ts).

import type { AppEvents, Backend, Command, Doc, Mode, Overlay, Pane, Plugin, Settings, Storage } from './types';

export const DISCARD_MESSAGE = '未保存の変更があります。破棄してよろしいですか？';
export const OVERWRITE_MESSAGE = 'ファイルが外部で変更されています。上書き保存してよろしいですか？';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/** Normalise a binding ("Ctrl+Shift+E") or a keyboard event to "ctrl+shift+e". */
export function keySpec(e: string | KeyLike): string {
  if (typeof e === 'string') {
    const parts = e.toLowerCase().split('+');
    const key = parts.pop() || '+'; // "Ctrl++" → key "+"
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
  return (
    (e.ctrlKey || e.metaKey ? 'ctrl+' : '') +
    (e.altKey ? 'alt+' : '') +
    (e.shiftKey && shiftMatters ? 'shift+' : '') +
    key
  );
}

/** Whether a plugin should be loaded, given the user's settings. */
export function isPluginEnabled(plugin: Pick<Plugin, 'name' | 'enabledByDefault'>, settings: Settings = {}): boolean {
  return settings.plugins?.[plugin.name] ?? plugin.enabledByDefault !== false;
}

/** In-memory Storage, used when none is supplied (tests, blocked localStorage). */
export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, String(v)) };
}

type Listener<A extends unknown[]> = (...args: A) => void;

export interface AppOptions {
  backend: Backend;
  storage?: Storage;
  settings?: Settings;
}

export class App {
  readonly backend: Backend;
  readonly storage: Storage;
  readonly settings: Settings;

  doc: Doc | null = null;
  mode: Mode = 'view';
  /** Message shown instead of the document (e.g. the file could not be opened). */
  error: string | null = null;

  #listeners = new Map<string, Listener<never[]>[]>();
  #subscribers = new Set<() => void>();
  #version = 0;
  #commands = new Map<string, Command>();
  #keymap = new Map<string, string>();
  #plugins: string[] = [];
  #panes = new Map<Mode, Pane>();
  #overlays: Overlay[] = [];
  #savedText = ''; // text as it is on disk
  #renderedText = ''; // text that doc.html was rendered from

  constructor({ backend, storage = memoryStorage(), settings = {} }: AppOptions) {
    this.backend = backend;
    this.storage = storage;
    this.settings = settings;
  }

  // ---- events ----
  on<E extends keyof AppEvents>(event: E, fn: Listener<AppEvents[E]>): () => void {
    const list = this.#listeners.get(event) ?? [];
    list.push(fn as Listener<never[]>);
    this.#listeners.set(event, list);
    return () => this.#listeners.set(event, (this.#listeners.get(event) ?? []).filter((f) => f !== fn));
  }

  emit<E extends keyof AppEvents>(event: E, ...args: AppEvents[E]): void {
    for (const fn of this.#listeners.get(event) ?? []) (fn as Listener<AppEvents[E]>)(...args);
    this.#changed();
  }

  // ---- React integration (useSyncExternalStore) ----
  subscribe = (fn: () => void): (() => void) => {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  };
  getVersion = (): number => this.#version;

  #changed() {
    this.#version++;
    for (const fn of this.#subscribers) fn();
  }

  // ---- commands & keys ----
  command(cmd: Command): void {
    if (this.#commands.has(cmd.id)) throw new Error(`command already registered: ${cmd.id}`);
    this.#commands.set(cmd.id, cmd);
    for (const k of cmd.keys ?? []) this.#keymap.set(keySpec(k), cmd.id);
  }

  run(id: string): unknown {
    const cmd = this.#commands.get(id);
    if (!cmd) throw new Error(`unknown command: ${id}`);
    return cmd.run();
  }

  hasCommand(id: string): boolean {
    return this.#commands.has(id);
  }

  /** Returns true if the key was handled (the caller should preventDefault). */
  handleKey(e: KeyLike): boolean {
    const id = this.#keymap.get(keySpec(e));
    if (!id) return false;
    void this.run(id);
    return true;
  }

  /** Registered commands (for the shortcut list). */
  commands(): Command[] {
    return [...this.#commands.values()];
  }

  // ---- UI contributions ----
  /** The component shown in a mode. Panes stay mounted; inactive ones get `active: false`. */
  addPane(mode: Mode, pane: Pane): void {
    this.#panes.set(mode, pane);
  }
  panes(): [Mode, Pane][] {
    return [...this.#panes];
  }
  hasPane(mode: Mode): boolean {
    return this.#panes.has(mode);
  }
  /** A component drawn on top of the panes (buttons, badges, toasts). */
  addOverlay(overlay: Overlay): void {
    this.#overlays.push(overlay);
  }
  overlays(): Overlay[] {
    return [...this.#overlays];
  }

  // ---- documents ----
  /** True if the text differs from the file on disk. */
  get dirty(): boolean {
    return !!this.doc && this.doc.raw !== this.#savedText;
  }

  /** Ask before throwing away unsaved edits. Resolves true if it is OK to proceed. */
  async confirmDiscard(): Promise<boolean> {
    return !this.dirty || this.backend.ask(DISCARD_MESSAGE);
  }

  async open(path: string, base: string | null = null): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    try {
      this.#loaded(await this.backend.load(path, base), true);
    } catch (err) {
      this.error = String(err);
      this.emit('doc:error', err);
    }
  }

  /** Re-read the file. Unsaved edits are kept unless `force` is set (callers ask first). */
  async reload({ force = false } = {}): Promise<boolean> {
    if (!this.doc || (this.dirty && !force)) return false;
    try {
      this.#loaded(await this.backend.load(this.doc.path), false);
      return true;
    } catch {
      return false; // the file may be mid-write; the next change retries
    }
  }

  /** Replace the current text (the editor calls this on every change). */
  update(text: string): void {
    if (!this.doc || text === this.doc.raw) return;
    const was = this.dirty;
    this.doc.raw = text;
    if (was !== this.dirty) this.emit('doc:dirty', this.dirty);
  }

  /** Re-render the current text if it changed since the last render. */
  async refresh(): Promise<void> {
    const doc = this.doc;
    if (!doc || doc.raw === this.#renderedText) return;
    const text = doc.raw;
    doc.html = await this.backend.render(text, doc.path);
    this.#renderedText = text;
    this.emit('doc:rendered', doc);
  }

  async save(): Promise<boolean> {
    const doc = this.doc;
    if (!doc) return false;
    const onDisk = await this.backend.mtime(doc.path);
    if (onDisk && onDisk !== doc.mtime && !(await this.backend.ask(OVERWRITE_MESSAGE))) return false;
    const text = doc.raw;
    try {
      doc.mtime = await this.backend.save(doc.path, text);
    } catch (err) {
      this.emit('toast', `保存できませんでした: ${String(err)}`);
      return false;
    }
    this.#savedText = text;
    this.emit('doc:saved', doc);
    this.emit('doc:dirty', this.dirty);
    if (this.mode === 'view') await this.refresh();
    return true;
  }

  async setMode(mode: Mode): Promise<void> {
    if (mode === this.mode || !this.#panes.has(mode)) return;
    this.mode = mode;
    if (mode === 'view') await this.refresh();
    this.emit('mode:changed', mode);
  }

  #loaded(doc: Doc, reset: boolean) {
    this.doc = doc;
    this.error = null;
    this.#savedText = this.#renderedText = doc.raw;
    this.emit('doc:loaded', doc, { reset });
    this.emit('doc:dirty', false);
  }

  // ---- plugins ----
  use(plugin: Plugin): this {
    if (this.#plugins.includes(plugin.name)) throw new Error(`plugin already registered: ${plugin.name}`);
    this.#plugins.push(plugin.name);
    plugin.setup(this);
    return this;
  }

  plugins(): string[] {
    return [...this.#plugins];
  }

  start(): void {
    this.emit('app:start');
  }
}
