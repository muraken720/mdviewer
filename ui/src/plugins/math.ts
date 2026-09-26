// Typesets TeX math with KaTeX. The Rust `math` plugin emits
// <span class="math math-inline|math-display">; ```math code blocks are display math too.
// KaTeX (JS, CSS, fonts) is loaded only when a document contains math.
import type { Plugin } from '../core/types';

type Katex = typeof import('katex').default;
let katex: Promise<Katex> | null = null;

function loadKatex(): Promise<Katex> {
  katex ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => m.default);
  return katex;
}

export const MATH_SELECTOR = '.math-inline, .math-display, pre > code.language-math';

export async function typeset(root: HTMLElement): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>(MATH_SELECTOR)];
  if (nodes.length === 0) return;
  const k = await loadKatex();
  for (const node of nodes) {
    const block = node.tagName === 'CODE';
    const target = block ? document.createElement('div') : node;
    const tex = node.textContent ?? '';
    k.render(tex, target, { displayMode: block || node.classList.contains('math-display'), throwOnError: false });
    if (block) node.parentElement?.replaceWith(target);
  }
}

const math: Plugin = {
  name: 'math',
  setup(app) {
    app.on('view:updated', (root) => void typeset(root).catch((e) => console.error(e)));
  },
};
export default math;
