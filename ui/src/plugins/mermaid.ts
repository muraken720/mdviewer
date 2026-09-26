// Mermaid diagrams for ```mermaid code blocks.
// The library is loaded only when a document contains a diagram, so it costs nothing at startup.
import type { Plugin } from '../core/types';

type Mermaid = typeof import('mermaid').default;
let mermaid: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  mermaid ??= import('mermaid').then(({ default: m }) => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
    return m;
  });
  return mermaid;
}

let seq = 0;

export async function renderDiagrams(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('pre > code.language-mermaid')];
  if (blocks.length === 0) return;
  const m = await loadMermaid();
  for (const code of blocks) {
    const pre = code.parentElement!;
    try {
      const { svg } = await m.render(`mermaid-${++seq}`, code.textContent ?? '');
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.innerHTML = svg;
      pre.replaceWith(div);
    } catch (err) {
      const note = document.createElement('p');
      note.className = 'error';
      note.textContent = `Mermaid: ${err instanceof Error ? err.message : String(err)}`;
      pre.after(note);
    }
  }
}

const mermaidPlugin: Plugin = {
  name: 'mermaid',
  setup(app) {
    app.on('view:updated', (root) => void renderDiagrams(root).catch((e) => console.error(e)));
  },
};
export default mermaidPlugin;
