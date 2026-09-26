// Tauri implementation of Backend. The Rust side is src-tauri/src/commands.rs.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Backend, Doc, Settings, Storage } from '../core/types';

export function tauriBackend(): Backend {
  const win = getCurrentWindow();
  return {
    settings: () => invoke<Settings>('settings'),
    open: (path) => invoke<Doc>('open', { path }),
    openLink: (href) => invoke<Doc>('open_link', { href }),
    reload: () => invoke<Doc>('reload'),
    render: (text) => invoke<string>('render', { text }),
    save: (text) => invoke<number>('save', { text }),
    mtime: () => invoke<number>('mtime'),
    pickFile: () => invoke<string | null>('pick_file'),
    ask: (message) => invoke<boolean>('ask', { message }),
    openUrl: (url) => invoke<void>('open_url', { url }),
    initialPath: () => invoke<string | null>('initial_path'),
    setTitle: (title) => win.setTitle(title),
    onOpenRequest: (cb) => {
      // Emitted by src-tauri/src/main.rs after the dropped file was allowed.
      void listen<string>('open-request', (e) => cb(e.payload));
    },
    onCloseRequested: (cb) => {
      void win.onCloseRequested(async (e) => {
        if (!(await cb())) e.preventDefault();
      });
    },
  };
}

/** localStorage, tolerating environments where it is blocked. */
export function browserStorage(): Storage {
  return {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, String(v));
      } catch {
        /* ignore */
      }
    },
  };
}
