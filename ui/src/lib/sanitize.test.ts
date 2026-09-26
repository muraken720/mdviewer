import { expect, test } from 'vitest';
import { sanitize } from './sanitize';

test('removes script, event handlers and navigation vectors', () => {
  const out = sanitize(
    '<p onclick="x()">a</p><script>x()</script><img src="x" onerror="x()">' +
      '<meta http-equiv="refresh" content="0;url=https://evil"><base href="https://evil/">' +
      '<form action="https://evil"><input name="q"></form><style>body{display:none}</style>' +
      '<iframe src="https://evil"></iframe><a href="javascript:alert(1)">j</a>',
  );
  for (const bad of [
    'onclick',
    'onerror',
    '<script',
    '<meta',
    '<base',
    '<form',
    '<style',
    '<iframe',
    'javascript:',
    'name=',
  ]) {
    expect(out).not.toContain(bad);
  }
});

test('keeps what the renderer produces', () => {
  const html =
    '<h1 id="title">T</h1><p><a href="#title">x</a> <a href="https://example.com">w</a> <a href="b.md">b</a></p>' +
    '<ul><li><input disabled="" type="checkbox" checked=""> done</li></ul>' +
    '<p><span class="math math-inline">x^2</span></p><pre><code class="language-mermaid">graph LR</code></pre>' +
    '<blockquote class="markdown-alert-note"><p>n</p></blockquote>' +
    '<img src="asset://localhost/%2Fd%2Fa.png" alt="a"><img src="http://asset.localhost/C%3A%5Ca.png" alt="b">' +
    '<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>';
  const out = sanitize(html);
  for (const keep of [
    'id="title"',
    'href="#title"',
    'href="https://example.com"',
    'href="b.md"',
    'type="checkbox"',
    'class="math math-inline"',
    'class="language-mermaid"',
    'class="markdown-alert-note"',
    'src="asset://localhost/%2Fd%2Fa.png"',
    'src="http://asset.localhost/C%3A%5Ca.png"',
    '<table>',
  ]) {
    expect(out).toContain(keep);
  }
});
