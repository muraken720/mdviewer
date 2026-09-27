import type { ComponentType } from 'react';
import type { App } from './app';
import type { Tab } from './tab';

/** A loaded document. `raw` is the current (possibly edited) text; `html` is its last render. */
export interface Doc {
  /** Host-side handle; reading and writing go through it, never through `path`. */
  id: number;
  path: string;
  name: string;
  raw: string;
  html: string;
  mtime: number;
}

export interface AppInfo {
  name: string;
  version: string;
  authors: string;
  license: string;
  repository: string;
}

/**
 * Host services. `backend/tauri.ts` implements it for the app; tests use `test/fake-backend.ts`.
 *
 * The host decides which files may be read or written (see src-tauri/src/session.rs): the UI can
 * open only files the user chose or relative links from an open document, and it reads/writes
 * open documents by their `id`.
 */
export interface Backend {
  settings(): Promise<Settings>;
  appInfo(): Promise<AppInfo>;
  /** Open a file the user chose (command line, dialog, drop, second launch). */
  open(path: string): Promise<Doc>;
  /** Open a relative link found in document `from`. */
  openLink(from: number, href: string): Promise<Doc>;
  /** Re-read a document. */
  reload(id: number): Promise<Doc>;
  /** Render unsaved text as if it were document `id`. */
  render(id: number, text: string): Promise<string>;
  /** Save document `id`; returns the new modification time. */
  save(id: number, text: string): Promise<number>;
  /** Modification time of document `id` (0 if unknown). */
  mtime(id: number): Promise<number>;
  /** The UI no longer shows document `id`. */
  closeDoc(id: number): Promise<void>;
  pickFile(): Promise<string | null>;
  /** OK/Cancel dialog; resolves true for OK. */
  ask(message: string): Promise<boolean>;
  openUrl(url: string): Promise<void>;
  initialPath(): Promise<string | null>;
  setTitle(title: string): Promise<void>;
  /** Theme of the window frame; `null` follows the OS. */
  setTheme(theme: 'light' | 'dark' | null): Promise<void>;
  /** Show the window. It starts hidden so it never appears before the theme is applied. */
  showWindow(): Promise<void>;
  /** Close the window (goes through `onCloseRequested`). */
  closeWindow(): Promise<void>;
  /** The user asked to open a file (drop, second launch). */
  onOpenRequest(cb: (path: string) => void): void;
  /** `cb` resolves false to cancel closing. */
  onCloseRequested(cb: () => Promise<boolean>): void;
}

export interface Settings {
  plugins?: Record<string, boolean>;
}

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string | number): void;
}

export type Mode = 'view' | 'edit';

export interface Command {
  id: string;
  /** Message key of the title (shown in menus and in the shortcut list). */
  title?: string;
  /** Key bindings; the first one is shown in menus. */
  keys?: string[];
  run: () => unknown;
  /** Greyed out in menus when false. */
  enabled?: () => boolean;
  /** Shown with a check mark in menus when true. */
  checked?: () => boolean;
}

/** A top-level menu (File, Edit, …). */
export interface MenuDef {
  id: string;
  /** Message key. */
  label: string;
  /** Access key (Alt + this letter opens the menu). */
  mnemonic: string;
  order: number;
}

/** A command placed in a menu. Items are sorted by `group`, then `order`; groups are separated. */
export interface MenuItemDef {
  menu: string;
  command: string;
  group: number;
  order?: number;
}

/** A UI plugin. Registered in `plugins/index.ts`. */
export interface Plugin {
  name: string;
  /** Defaults to true. Users override it with `settings.json` → `plugins.<name>`. */
  enabledByDefault?: boolean;
  setup(app: App): void;
}

/** Props passed to pane components (one instance per tab and mode). */
export interface PaneProps {
  app: App;
  tab: Tab;
  /** This tab is the active one and is in this pane's mode. */
  active: boolean;
}
export type Pane = ComponentType<PaneProps>;
/** Components drawn above the tab contents (menu bar, tab bar). */
export type Bar = ComponentType<{ app: App }>;
export type Overlay = ComponentType<{ app: App }>;

/** Events emitted by the app. Plugins may emit their own (use a `plugin:` prefix). */
export interface AppEvents {
  'app:start': [];
  'doc:loaded': [doc: Doc, opts: { reset: boolean; tab: Tab }];
  'doc:rendered': [doc: Doc, tab: Tab];
  'doc:dirty': [dirty: boolean, tab: Tab];
  'doc:saved': [doc: Doc, tab: Tab];
  'mode:changed': [mode: Mode, tab: Tab];
  /** A tab was opened, closed or activated. */
  'tabs:changed': [];
  'lang:changed': [];
  toast: [message: string];
  /** A tab's viewer element after its HTML was replaced (plugins post-process it). */
  'view:updated': [root: HTMLElement, tab: Tab];
  [custom: `plugin:${string}`]: unknown[];
}
