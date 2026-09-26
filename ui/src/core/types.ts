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

/** Host services. `backend/tauri.ts` implements it for the app; tests use `test/fake-backend.ts`. */
export interface Backend {
  settings(): Promise<Settings>;
  load(path: string, base?: string | null): Promise<Doc>;
  render(text: string, path: string): Promise<string>;
  /** Returns the new modification time. */
  save(path: string, text: string): Promise<number>;
  mtime(path: string): Promise<number>;
  pickFile(): Promise<string | null>;
  /** OK/Cancel dialog; resolves true for OK. */
  ask(message: string): Promise<boolean>;
  openUrl(url: string): Promise<void>;
  initialPath(): Promise<string | null>;
  setTitle(title: string): Promise<void>;
  onDrop(cb: (paths: string[]) => void): void;
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
  'toast': [message: string];
  /** The viewer's element after its HTML was replaced (plugins post-process it). */
  'view:updated': [root: HTMLElement];
  [custom: `plugin:${string}`]: unknown[];
}
