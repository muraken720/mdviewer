// Link handling: #anchors scroll, web links open in the browser, relative paths open in the viewer.
import type { App } from '../core/app';
import type { Plugin } from '../core/types';

export type LinkKind = 'anchor' | 'web' | 'file' | 'ignore';

/**
 * What clicking a link does. Only plain relative paths open in the viewer: absolute paths, drive
 * letters and network shares (`//host`, `\\host`) are ignored. The Rust side enforces the same
 * rules (src-tauri/src/session.rs); this just avoids pointless requests.
 */
export function classifyLink(href: string | null): LinkKind {
  if (!href) return 'ignore';
  if (href.startsWith('#')) return 'anchor';
  if (/^(https?:|mailto:)/i.test(href)) return 'web';
  if (/^[\\/]/.test(href) || href.includes(':')) return 'ignore'; // absolute, UNC, other schemes
  return 'file';
}

/** Element id for "#fragment" (tolerates malformed percent-encoding). */
export function anchorId(href: string): string {
  const raw = href.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function followLink(app: App, href: string | null, root: ParentNode = document): void {
  if (!href) return;
  switch (classifyLink(href)) {
    case 'anchor':
      // Look up the id inside this tab's document only (several tabs can have the same ids).
      root.querySelector(`[id="${CSS.escape(anchorId(href))}"]`)?.scrollIntoView();
      break;
    case 'web':
      void app.backend.openUrl(href);
      break;
    case 'file':
      void app.openLink(href);
      break;
    case 'ignore':
      break;
  }
}

const wired = new WeakSet<HTMLElement>();

const links: Plugin = {
  name: 'links',
  setup(app) {
    app.on('view:updated', (root) => {
      if (wired.has(root)) return;
      wired.add(root);
      // Every link is handled here; nothing in the document may navigate the window.
      // `auxclick` covers middle-click (which would otherwise open a new window).
      const onClick = (e: MouseEvent) => {
        const a = (e.target as Element).closest('a, area');
        if (!a) return;
        e.preventDefault();
        if (e.type === 'click') followLink(app, a.getAttribute('href') ?? a.getAttribute('xlink:href'), root);
      };
      root.addEventListener('click', onClick);
      root.addEventListener('auxclick', onClick);
    });
  },
};
export default links;
