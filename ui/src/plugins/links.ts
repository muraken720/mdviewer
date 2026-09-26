// Link handling: #anchors scroll, web links open in the browser, relative paths open in the viewer.
import type { App } from '../core/app';
import type { Plugin } from '../core/types';

export type LinkKind = 'anchor' | 'web' | 'file' | 'ignore';

export function classifyLink(href: string | null): LinkKind {
  if (!href) return 'ignore';
  if (href.startsWith('#')) return 'anchor';
  if (/^(https?:|mailto:)/i.test(href)) return 'web';
  if (/^[a-z]:[\\/]/i.test(href)) return 'file'; // Windows absolute path (C:\...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return 'ignore'; // javascript:, file:, etc.
  return 'file';
}

export function followLink(app: App, href: string | null): void {
  switch (classifyLink(href)) {
    case 'anchor':
      document.getElementById(decodeURIComponent(href!.slice(1)))?.scrollIntoView();
      break;
    case 'web':
      void app.backend.openUrl(href!);
      break;
    case 'file':
      void app.open(href!, app.doc?.path ?? null);
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
      root.addEventListener('click', (e) => {
        const a = (e.target as Element).closest('a[href]');
        if (!a) return;
        e.preventDefault();
        followLink(app, a.getAttribute('href'));
      });
    });
  },
};
export default links;
