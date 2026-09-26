// Tauri implementation of Backend. The Rust side is src-tauri/src/commands.rs.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppInfo, Backend, Doc, Settings, Storage } from '../core/types';

export function tauriBackend(): Backend {
  const win = getCurrentWindow();
  return {
    settings: () => invoke<Settings>('settings'),
    appInfo: () => invoke<AppInfo>('app_info'),
    open: (path) => invoke<Doc>('open', { path }),
    openLink: (from, href) => invoke<Doc>('open_link', { from, href }),
    reload: (doc) => invoke<Doc>('reload', { doc }),
    render: (doc, text) => invoke<string>('render', { doc, text }),
    save: (doc, text) => invoke<number>('save', { doc, text }),
    mtime: (doc) => invoke<number>('mtime', { doc }),
    closeDoc: (doc) => invoke<void>('close_doc', { doc }),
    pickFile: () => invoke<string | null>('pick_file'),
    ask: (message) => invoke<boolean>('ask', { message }),
    openUrl: (url) => invoke<void>('open_url', { url }),
    initialPath: () => invoke<string | null>('initial_path'),
    setTitle: (title) => win.setTitle(title),
    setTheme: (theme) => win.setTheme(theme),
    closeWindow: () => win.close(),
    onOpenRequest: (cb) => {
      // Emitted by src-tauri/src/main.rs after the file was allowed (drop, second launch).
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
