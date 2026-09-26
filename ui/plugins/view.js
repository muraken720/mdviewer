// Shows the rendered HTML or the raw Markdown, and toggles between them.
export default {
  name: 'view',
  setup(app) {
    const $view = document.getElementById('view');
    const $raw = document.getElementById('raw');
    const $toggle = document.getElementById('toggle');

    const apply = () => {
      const raw = app.mode === 'raw' && !!app.doc;
      $view.hidden = raw;
      $raw.hidden = !raw;
      $toggle.textContent = raw ? 'View' : 'Raw';
    };

    app.on('doc:loaded', (doc, { reset }) => {
      const y = window.scrollY;
      $view.innerHTML = doc.html;
      $raw.textContent = doc.raw;
      $toggle.hidden = false;
      apply();
      window.scrollTo(0, reset ? 0 : y);
    });

    app.on('doc:error', (err) => {
      const p = document.createElement('p');
      p.className = 'error';
      p.textContent = String(err);
      $view.replaceChildren(p);
      app.setMode('view');
      apply();
    });

    app.on('mode:changed', apply);
    app.command('view.toggleRaw', () => app.setMode(app.mode === 'raw' ? 'view' : 'raw'), ['Ctrl+E']);
    $toggle.addEventListener('click', () => app.run('view.toggleRaw'));
  },
};
