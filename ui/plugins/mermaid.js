// Mermaid diagrams for ```mermaid code blocks. Disable with
//   { "plugins": { "mermaid": false } }  in settings.json.
// The library (ui/vendor/mermaid, ~3.5 MB) is loaded only when a document contains a diagram,
// so it costs nothing at startup.
const SRC = 'vendor/mermaid/mermaid.min.js';

let loading = null;
function loadMermaid() {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.onload = () => {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
      resolve(window.mermaid);
    };
    s.onerror = () => reject(new Error(`failed to load ${SRC}`));
    document.head.append(s);
  });
  return loading;
}

let seq = 0;
async function renderDiagrams(root) {
  const blocks = [...root.querySelectorAll('pre > code.language-mermaid')];
  if (blocks.length === 0) return;
  const mermaid = await loadMermaid();
  for (const code of blocks) {
    const pre = code.parentElement;
    try {
      const { svg } = await mermaid.render(`mermaid-${++seq}`, code.textContent);
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.innerHTML = svg;
      pre.replaceWith(div);
    } catch (err) {
      const note = document.createElement('p');
      note.className = 'error';
      note.textContent = `Mermaid: ${err?.message ?? err}`;
      pre.after(note);
    }
  }
}

export default {
  name: 'mermaid',
  setup(app) {
    const $view = document.getElementById('view');
    const run = () => renderDiagrams($view).catch((e) => console.error(e));
    app.on('doc:loaded', run);
    app.on('doc:rendered', run);
  },
};
