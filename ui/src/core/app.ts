// mdviewer UI core: tabs, documents, events, commands/keymap, menus, i18n and the plugin host.
// No DOM, React or Tauri access here, so it is unit-tested directly (app.test.ts).

import { I18n, isLangSetting, type LangSetting, type MessageKey } from '../i18n';
import { type HistoryEntry, Tab } from './tab';
import type {
  AppEvents,
  Backend,
  Bar,
  Command,
  Doc,
  MenuDef,
  MenuItemDef,
  Mode,
  Overlay,
  Pane,
  Plugin,
  Settings,
  Storage,
} from './types';

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

/** `{ code, detail }` errors from the host (see src-tauri/src/error.rs). */
function errorCode(err: unknown): { code: string; detail?: string } | null {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return { code: err.code, detail: 'detail' in err ? String(err.detail) : undefined };
  }
  return null;
}

type Listener<A extends unknown[]> = (...args: A) => void;

export interface AppOptions {
  backend: Backend;
  storage?: Storage;
  settings?: Settings;
  /** Preferred languages of the OS (`navigator.languages`). */
  languages?: readonly string[];
}

export interface Menu {
  def: MenuDef;
  /** Commands in groups (render a separator between groups). */
  groups: Command[][];
}

export class App {
  readonly backend: Backend;
  readonly storage: Storage;
  readonly settings: Settings;
  readonly i18n: I18n;

  #tabs: Tab[] = [new Tab()];
  #activeId = this.#tabs[0]?.id ?? 0;
  #listeners = new Map<string, Listener<never[]>[]>();
  #subscribers = new Set<() => void>();
  #version = 0;
  #commands = new Map<string, Command>();
  #keymap = new Map<string, string>();
  #plugins: string[] = [];
  #panes = new Map<Mode, Pane>();
  #bars: Bar[] = [];
  #overlays: Overlay[] = [];
  #menus = new Map<string, MenuDef>();
  #menuItems: MenuItemDef[] = [];

  constructor({ backend, storage = memoryStorage(), settings = {}, languages = [] }: AppOptions) {
    this.backend = backend;
    this.storage = storage;
    this.settings = settings;
    const saved = storage.get('lang');
    this.i18n = new I18n(isLangSetting(saved) ? saved : 'auto', languages);
  }

  // ---- i18n ----
  t = (key: MessageKey | (string & {}), params?: Record<string, string | number>): string => this.i18n.t(key, params);

  setLanguage(setting: LangSetting): void {
    this.i18n.set(setting);
    this.storage.set('lang', setting);
    this.emit('lang:changed');
  }

  /** A user-facing message for an error from the host or elsewhere. */
  formatError(err: unknown): string {
    const coded = errorCode(err);
    if (coded) return this.t(`error.${coded.code}`, { detail: coded.detail ?? '' });
    return err instanceof Error ? err.message : String(err);
  }

  // ---- events ----
  on<E extends keyof AppEvents>(event: E, fn: Listener<AppEvents[E]>): () => void {
    const list = this.#listeners.get(event) ?? [];
    list.push(fn as Listener<never[]>);
    this.#listeners.set(event, list);
    return () =>
      this.#listeners.set(
        event,
        (this.#listeners.get(event) ?? []).filter((f) => f !== fn),
      );
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
    if (cmd.enabled && !cmd.enabled()) return undefined;
    return cmd.run();
  }

  hasCommand(id: string): boolean {
    return this.#commands.has(id);
  }

  getCommand(id: string): Command | undefined {
    return this.#commands.get(id);
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

  // ---- menus ----
  addMenu(def: MenuDef): void {
    this.#menus.set(def.id, def);
  }

  addMenuItem(item: MenuItemDef): void {
    this.#menuItems.push(item);
  }

  /** Menus in order, with their registered commands grouped. Missing commands are skipped. */
  menus(): Menu[] {
    return [...this.#menus.values()]
      .sort((a, b) => a.order - b.order)
      .map((def) => {
        const items = this.#menuItems
          .filter((i) => i.menu === def.id && this.#commands.has(i.command))
          .sort((a, b) => a.group - b.group || (a.order ?? 0) - (b.order ?? 0));
        const groups: Command[][] = [];
        let last: number | undefined;
        for (const item of items) {
          if (item.group !== last) groups.push([]);
          last = item.group;
          groups.at(-1)?.push(this.#commands.get(item.command) as Command);
        }
        return { def, groups };
      })
      .filter((m) => m.groups.length > 0);
  }

  // ---- UI contributions ----
  /** The component shown for a mode, instantiated once per tab. */
  addPane(mode: Mode, pane: Pane): void {
    this.#panes.set(mode, pane);
  }
  panes(): [Mode, Pane][] {
    return [...this.#panes];
  }
  hasPane(mode: Mode): boolean {
    return this.#panes.has(mode);
  }
  /** A component above the tab contents (menu bar, tab bar). */
  addBar(bar: Bar): void {
    this.#bars.push(bar);
  }
  bars(): Bar[] {
    return [...this.#bars];
  }
  /** A component drawn on top of everything (buttons, badges, dialogs, toasts). */
  addOverlay(overlay: Overlay): void {
    this.#overlays.push(overlay);
  }
  overlays(): Overlay[] {
    return [...this.#overlays];
  }

  // ---- tabs ----
  get tabs(): readonly Tab[] {
    return this.#tabs;
  }

  get active(): Tab {
    return this.#tabs.find((t) => t.id === this.#activeId) ?? (this.#tabs[0] as Tab);
  }

  /** Shortcuts for the active tab. */
  get doc(): Doc | null {
    return this.active.doc;
  }
  get mode(): Mode {
    return this.active.mode;
  }
  get dirty(): boolean {
    return this.active.dirty;
  }

  activate(id: number): void {
    if (id === this.#activeId || !this.#tabs.some((t) => t.id === id)) return;
    this.#activeId = id;
    this.emit('tabs:changed');
  }

  /** Activate the next (+1) or previous (-1) tab, wrapping around. */
  cycleTab(step: 1 | -1): void {
    const i = this.#tabs.indexOf(this.active);
    const next = this.#tabs[(i + step + this.#tabs.length) % this.#tabs.length];
    if (next) this.activate(next.id);
  }

  /** Close a tab (asking first if it has unsaved edits). The last tab becomes empty instead. */
  async closeTab(id = this.#activeId): Promise<boolean> {
    const tab = this.#tabs.find((t) => t.id === id);
    if (!tab || !(await this.confirmDiscard(tab))) return false;
    if (tab.doc) void this.backend.closeDoc(tab.doc.id);
    const i = this.#tabs.indexOf(tab);
    this.#tabs = this.#tabs.filter((t) => t !== tab);
    if (this.#tabs.length === 0) this.#tabs = [new Tab()];
    if (tab.id === this.#activeId) this.#activeId = (this.#tabs[Math.min(i, this.#tabs.length - 1)] as Tab).id;
    this.emit('tabs:changed');
    return true;
  }

  // ---- documents ----
  /** Ask before throwing away unsaved edits in `tab`. Resolves true if it is OK to proceed. */
  async confirmDiscard(tab: Tab = this.active): Promise<boolean> {
    return !tab.dirty || this.backend.ask(this.t('confirm.discard'));
  }

  /** Ask once before closing the window if any tab has unsaved edits. */
  async confirmExit(): Promise<boolean> {
    return !this.#tabs.some((t) => t.dirty) || this.backend.ask(this.t('confirm.exit'));
  }

  /**
   * Open a file the user chose. If it is already open, its tab is activated; otherwise it opens in
   * the active tab when that is empty, or in a new tab.
   */
  async open(path: string): Promise<void> {
    const existing = this.#tabs.find((t) => t.doc?.path === path);
    if (existing) return this.activate(existing.id);
    let doc: Doc;
    try {
      doc = await this.backend.open(path);
    } catch (err) {
      this.emit('toast', this.formatError(err));
      return;
    }
    let tab = this.active;
    if (!tab.empty) {
      tab = new Tab();
      this.#tabs.push(tab);
    }
    this.#activeId = tab.id;
    this.#loaded(tab, doc, { reset: true, scroll: 0 });
    this.emit('tabs:changed');
  }

  /** Open a relative link from the active document in the same tab (Back returns to it). */
  async openLink(href: string): Promise<void> {
    const tab = this.active;
    const from = tab.doc;
    if (!from || !(await this.confirmDiscard(tab))) return;
    try {
      const doc = await this.backend.openLink(from.id, href);
      this.#navigate(tab, doc, tab.back, 0);
      tab.forward = [];
    } catch (err) {
      this.emit('toast', this.formatError(err));
    }
  }

  canGoBack(): boolean {
    return this.active.back.length > 0;
  }
  canGoForward(): boolean {
    return this.active.forward.length > 0;
  }

  back(): Promise<void> {
    return this.#travel(this.active.back, this.active.forward);
  }
  forward(): Promise<void> {
    return this.#travel(this.active.forward, this.active.back);
  }

  async #travel(from: HistoryEntry[], to: HistoryEntry[]): Promise<void> {
    const tab = this.active;
    const target = from.at(-1);
    if (!target || !(await this.confirmDiscard(tab))) return;
    try {
      const doc = await this.backend.open(target.path);
      from.pop();
      this.#navigate(tab, doc, to, target.scroll);
    } catch (err) {
      this.emit('toast', this.formatError(err));
    }
  }

  /** Show `doc` in `tab`, remembering the current page in `push`. */
  #navigate(tab: Tab, doc: Doc, push: HistoryEntry[], scroll: number) {
    const current = tab.entry();
    if (current) push.push(current);
    if (tab.doc) void this.backend.closeDoc(tab.doc.id);
    this.#loaded(tab, doc, { reset: true, scroll });
  }

  /** Re-read the active document. Unsaved edits are kept unless `force` is set (callers ask first). */
  async reload({ force = false, tab = this.active } = {}): Promise<boolean> {
    if (!tab.doc || (tab.dirty && !force)) return false;
    try {
      this.#loaded(tab, await this.backend.reload(tab.doc.id), { reset: false });
      return true;
    } catch {
      return false; // the file may be mid-write; the next change retries
    }
  }

  /** Replace the active tab's text (the editor calls this on every change). */
  update(text: string, tab: Tab = this.active): void {
    if (!tab.doc || text === tab.doc.raw) return;
    const was = tab.dirty;
    tab.doc.raw = text;
    if (was !== tab.dirty) this.emit('doc:dirty', tab.dirty, tab);
  }

  /** Re-render a tab's text if it changed since the last render. */
  async refresh(tab: Tab = this.active): Promise<void> {
    const doc = tab.doc;
    if (!doc || doc.raw === tab.renderedText) return;
    const text = doc.raw;
    doc.html = await this.backend.render(doc.id, text);
    tab.renderedText = text;
    this.emit('doc:rendered', doc, tab);
  }

  async save(tab: Tab = this.active): Promise<boolean> {
    const doc = tab.doc;
    if (!doc) return false;
    const onDisk = await this.backend.mtime(doc.id);
    if (onDisk && onDisk !== doc.mtime && !(await this.backend.ask(this.t('confirm.overwrite')))) return false;
    const text = doc.raw;
    try {
      doc.mtime = await this.backend.save(doc.id, text);
    } catch (err) {
      this.emit('toast', this.t('toast.saveFailed', { detail: this.formatError(err) }));
      return false;
    }
    tab.savedText = text;
    this.emit('doc:saved', doc, tab);
    this.emit('doc:dirty', tab.dirty, tab);
    if (tab.mode === 'view') await this.refresh(tab);
    return true;
  }

  async setMode(mode: Mode, tab: Tab = this.active): Promise<void> {
    if (mode === tab.mode || !this.#panes.has(mode) || !tab.doc) return;
    tab.mode = mode;
    if (mode === 'view') await this.refresh(tab);
    this.emit('mode:changed', mode, tab);
  }

  #loaded(tab: Tab, doc: Doc, { reset, scroll }: { reset: boolean; scroll?: number }) {
    tab.doc = doc;
    tab.savedText = tab.renderedText = doc.raw;
    if (reset) {
      tab.mode = 'view';
      tab.scroll = scroll ?? 0;
    }
    this.emit('doc:loaded', doc, { reset, tab });
    this.emit('doc:dirty', false, tab);
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
