// Link handling: #anchors scroll, web links open in the browser, relative paths open in the viewer.

/** @returns {'anchor'|'web'|'file'|'ignore'} */
export function classifyLink(href) {
  if (!href) return 'ignore';
  if (href.startsWith('#')) return 'anchor';
  if (/^(https?:|mailto:)/i.test(href)) return 'web';
  if (/^[a-z]:[\\/]/i.test(href)) return 'file';            // Windows absolute path (C:\...)
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return 'ignore';   // javascript:, file:, etc.
  return 'file';
}

export default {
  name: 'links',
  setup(app) {
    document.getElementById('view').addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      switch (classifyLink(href)) {
        case 'anchor':
          document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
          break;
        case 'web':
          app.backend.openUrl(href);
          break;
        case 'file':
          app.open(href, app.doc?.path ?? null);
          break;
      }
    });
  },
};
