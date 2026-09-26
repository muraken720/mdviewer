import type { ComponentType } from 'react';
import type { App } from './app';

/** A loaded document. `raw` is the current (possibly edited) text; `html` is its last render. */
export interface Doc {
  path: string;
  name: string;
  raw: string;
  html: string;
  mtime: number;
}

/**
 * Host services. `backend/tauri.ts` implements it for the app; tests use `test/fake-backend.ts`.
 *
 * The host decides which files may be read or written (see src-tauri/src/session.rs): the UI can
 * open only files the user chose or relative links from the current document, and `reload`,
 * `render`, `save` and `mtime` always act on the current document.
 */
export interface Backend {
  settings(): Promise<Settings>;
  /** Open a file the user chose (command line, dialog, drop). */
  open(path: string): Promise<Doc>;
  /** Open a relative link found in the current document. */
  openLink(href: string): Promise<Doc>;
  /** Re-read the current document. */
  reload(): Promise<Doc>;
  /** Render unsaved text as if it were the current document. */
  render(text: string): Promise<string>;
  /** Save to the current document; returns the new modification time. */
  save(text: string): Promise<number>;
  /** Modification time of the current document (0 if unknown). */
  mtime(): Promise<number>;
  pickFile(): Promise<string | null>;
  /** OK/Cancel dialog; resolves true for OK. */
  ask(message: string): Promise<boolean>;
  openUrl(url: string): Promise<void>;
  initialPath(): Promise<string | null>;
  setTitle(title: string): Promise<void>;
  /** The user dropped a file on the window. */
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
  /** Shown in the shortcut list on the start screen. */
  title?: string;
  keys?: string[];
  run: () => unknown;
}

/** A UI plugin. Registered in `plugins/index.ts`. */
export interface Plugin {
  name: string;
  /** Defaults to true. Users override it with `settings.json` → `plugins.<name>`. */
  enabledByDefault?: boolean;
  setup(app: App): void;
}

/** Props passed to pane and overlay components. */
export interface PaneProps {
  app: App;
  active: boolean;
}
export type Pane = ComponentType<PaneProps>;
export type Overlay = ComponentType<{ app: App }>;

/** Events emitted by the app. Plugins may emit their own (use a `plugin:` prefix). */
export interface AppEvents {
  'app:start': [];
  'doc:loaded': [doc: Doc, opts: { reset: boolean }];
  'doc:rendered': [doc: Doc];
  'doc:dirty': [dirty: boolean];
  'doc:saved': [doc: Doc];
  'doc:error': [error: unknown];
  'mode:changed': [mode: Mode];
  toast: [message: string];
  /** The viewer's element after its HTML was replaced (plugins post-process it). */
  'view:updated': [root: HTMLElement];
  [custom: `plugin:${string}`]: unknown[];
}
