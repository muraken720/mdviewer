// Mermaid diagrams for ```mermaid code blocks.
// The library is loaded only when a document contains a diagram, so it costs nothing at startup.
import type { Plugin } from '../core/types';
import { currentTheme } from './theme';

type Mermaid = typeof import('mermaid').default;
let mermaid: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  mermaid ??= import('mermaid').then(({ default: m }) => m);
  return mermaid;
}

let seq = 0;

/** Draw `source` into `target` (a `div.mermaid`), in the current theme. */
async function draw(m: Mermaid, target: HTMLElement, source: string): Promise<void> {
  const { svg } = await m.render(`mermaid-${++seq}`, source);
  target.innerHTML = svg;
}

function configure(m: Mermaid): void {
  m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: currentTheme() === 'dark' ? 'dark' : 'default' });
}

export async function renderDiagrams(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('pre > code.language-mermaid')];
  if (blocks.length === 0) return;
  const m = await loadMermaid();
  configure(m);
  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre) continue;
    const source = code.textContent ?? '';
    try {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.dataset.source = source; // kept so the diagram can be redrawn when the theme changes
      await draw(m, div, source);
      pre.replaceWith(div);
    } catch (err) {
      const note = document.createElement('p');
      note.className = 'error';
      note.textContent = `Mermaid: ${err instanceof Error ? err.message : String(err)}`;
      pre.after(note);
    }
  }
}

/** Redraw every diagram on the page (all tabs) in the current theme. */
export async function redrawDiagrams(): Promise<void> {
  const divs = [...document.querySelectorAll<HTMLElement>('div.mermaid[data-source]')];
  if (divs.length === 0) return;
  const m = await loadMermaid();
  configure(m);
  for (const div of divs) {
    await draw(m, div, div.dataset.source ?? '').catch((e) => console.error(e));
  }
}

const mermaidPlugin: Plugin = {
  name: 'mermaid',
  setup(app) {
    app.on('view:updated', (root) => void renderDiagrams(root).catch((e) => console.error(e)));
    app.on('plugin:theme', () => void redrawDiagrams());
  },
};
export default mermaidPlugin;
