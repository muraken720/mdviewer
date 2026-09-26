// Sanitises the rendered document before it is inserted into the page.
//
// Markdown may contain raw HTML. The CSP already stops scripts; this removes what would still be
// harmful without script: forms and <meta http-equiv="refresh"> (navigation away from the app),
// <style> (restyling or spoofing the app UI), and `name` attributes (DOM clobbering).
import DOMPurify from 'dompurify';

/** Default DOMPurify URI rule plus `asset:`, the scheme of local images on Linux/macOS. */
const ALLOWED_URI = /^(?:(?:https?|mailto|asset):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'meta', 'base', 'link'],
    FORBID_ATTR: ['name', 'formaction', 'action'],
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    // Heading ids such as "title" must survive for #links; clobbering is covered by `name` above.
    SANITIZE_DOM: false,
  });
}
